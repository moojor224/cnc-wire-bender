import * as THREE from "three";
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, Plane, PlaneGeometry, Raycaster, Vector2, Vector3 } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { Breadboard } from "./breadboard.js";
import { dist, round, slice } from "./slicer.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { getLocalStorage } from "./index.js";


const layer_offset = 0.1;
const material = new THREE.MeshMatcapMaterial({
    color: 0xf9e94d,
    matcap: new THREE.TextureLoader().load("/cnc-wire-bender/matcap-porcelain-white.jpg"),
    side: THREE.FrontSide,
});
/** material to use for the wire */
const wire_material = material.clone();
wire_material.color = new THREE.Color(0xff0000);
const linesgroup = new Group();
/** how far the wire goes into the breadboard */
const wire_depth = 6.5; // convert to gui option
const gui = new GUI({
    title: "Options",
});

/**
 * @template T
 * @param {T} obj 
 * @returns {T}
 */
function proxy(obj) {
    return new Proxy(obj, {
        get: function (target, key) {
            if (typeof target[key] == "object") {
                return proxy(target[key]);
            }
            return target[key];
        },
        set: function (target, key, value) {
            target[key] = value;
            rerender();
            localStorage.setItem("breadboard_config", JSON.stringify(target));
            return true;
        }
    });
}
/** @type {typeof Breadboard.defaultConfig} */
const breadboard_config = JSON.parse(JSON.stringify(getLocalStorage("breadboard_config", Breadboard.defaultConfig)));
const proxy_config = proxy(breadboard_config);

let timeout = 0;
function rerender() {
    clearTimeout(timeout);
    timeout = setTimeout(construct, 3000);
}
const config_folder = gui.addFolder("breadboard config");

config_folder.add(proxy_config, "hole_spacing");
config_folder.add(proxy_config, "hole_inner_width");
config_folder.add(proxy_config, "hole_outer_width");
config_folder.add(proxy_config, "hole_inner_depth");
config_folder.add(proxy_config, "hole_outer_depth");
config_folder.add(proxy_config, "num_sections");
config_folder.add(proxy_config, "num_subsections");
config_folder.add(proxy_config, "subsection_spacing");
config_folder.add(proxy_config, "rows_per_section");
config_folder.add(proxy_config, "holes_per_row");
config_folder.add(proxy_config, "board_thickness");
config_folder.add(proxy_config, "num_breadboards_x");
config_folder.add(proxy_config, "num_breadboards_y");
config_folder.add(proxy_config, "breadboard_x_gap");
config_folder.add(proxy_config, "breadboard_y_gap");
config_folder.close();

const power_rails_folder = config_folder.addFolder("power rails");
power_rails_folder.add(proxy_config.power_rails, "enabled");
power_rails_folder.add(proxy_config.power_rails, "num_cols");
power_rails_folder.add(proxy_config.power_rails, "holes_per_section");
power_rails_folder.add(proxy_config.power_rails, "main_spacing");
// power_rails_folder.close();

const labels_folder = config_folder.addFolder("labels");
labels_folder.add(proxy_config.labels, "enabled");
labels_folder.add(proxy_config.labels, "start");
labels_folder.add(proxy_config.labels, "increment");
// labels_folder.close();




/** current layer to place wire nodes on */
let target_layer = 0;
/** distance between layers. this should be the same as hole_spacing */
let layer_height = 0;
let selected_holes = [];

export function construct() {
    selected_holes = [];
    breadboard_group.clear();
    breadboard = new Breadboard(proxy_config);
    breadboard_group.add(breadboard.object);
    breadboard.object.rotateX(degToRad(-90));
    breadboard.object.translateY(-breadboard.total_length / 2);
    breadboard.object.translateX(-breadboard.total_width / 2);
    let fp = breadboard.face_plate;
    fp.rotateX(degToRad(-90));
    fp.translateY(-breadboard.total_length / 2);
    fp.translateX(-breadboard.total_width / 2);
    faceplate = fp;
    cursor_group.clear();
    cursor_group.add(makeCursor());
    layer_height = breadboard.config.hole_spacing;
    render_holes();
}
window.construct = construct;

/** @type {Breadboard} */
let breadboard = null;
/** @type {Mesh} */
let faceplate = null;
function makeCursor() {
    let s = breadboard.config.hole_spacing;
    let cursor = new Mesh(new PlaneGeometry(s, s), new MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    }));
    cursor.rotateX(degToRad(-90));
    cursor.position.set(0, 0.2, 0);
    cursor.visible = true; // whether translucent square is visible on hovered holes
    return cursor;
}

/** @type {THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>} */
let cursor_group = new Group();


const breadboard_group = new Group();
construct();

/**
 * @typedef Manager
 * @prop {typeof breadboard_group} group
 * @prop {typeof breadboard} breadboard
 * @prop {typeof faceplate} faceplate
 * @prop {typeof cursor} cursor
 * @prop {typeof mousemove} mousemove
 * @prop {typeof mousedown} mousedown
 * @prop {typeof mouseup} mouseup
 * @prop {typeof set_target_layer} set_target_layer
 * @prop {typeof render_holes} render_holes
 * @prop {typeof linesgroup} linesgroup
 * @prop {typeof slice_wire} slice_wire
 * @prop {typeof clear} clear
 */

/** @type {Manager} */
export const manager = new Proxy({}, {
    get: function (target, key) {
        switch (key) {
            case "group": return breadboard_group;
            case "breadboard": return breadboard;
            case "faceplate": return faceplate;
            case "cursor": return cursor_group;
            case "mousemove": return mousemove;
            case "mousedown": return mousedown;
            case "mouseup": return mouseup;
            case "set_target_layer": return set_target_layer;
            case "render_holes": return render_holes;
            case "linesgroup": return linesgroup;
            case "slice_wire": return slice_wire;
            case "clear": return clear;
        }
        return undefined;
    }
});

let can_select = true;
let mouse_down = false;
const plane = new Plane(new Vector3(0, 1, 0), 0);
const mouse = new Vector2();
const raycaster = new Raycaster();
const intersects = new Vector3();

/**
 * @param {MouseEvent} event
 * @param {THREE.PerspectiveCamera} camera
 */
function mousemove(event, camera) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, intersects);
    cursor_group.position.set(intersects.x, intersects.y, intersects.z);
    let x = cursor_group.position.x + breadboard.total_width / 2;
    let y = -cursor_group.position.z + breadboard.total_length / 2;
    if (x >= 0 && x <= breadboard.total_width && y >= 0 && y <= breadboard.total_length) {
        breadboard.select_hole(x, y);
    } else {
        breadboard.deselect_hole();
    }
    if (mouse_down) {
        can_select = false;
        console.log("dragging");
    }
    if (breadboard.selected_hole) {
        let hole = breadboard.selected_hole;
        cursor_group.position.x = hole.x + hole.width / 2 - breadboard.total_width / 2;
        cursor_group.position.z = -(hole.y + hole.height / 2) + breadboard.total_length / 2;
        cursor_group.visible = true;
    } else {
        cursor_group.visible = false;
    }
}
function mousedown() {
    mouse_down = true;
}
function mouseup(event) {
    let mode = "create";
    if (event.button == 2) mode = "delete";
    try {
        if (!can_select) {
            return;
        }
        if (!breadboard.selected_hole) {
            // throw new Error("No hole selected");
            return;
        }
        let hole = breadboard.selected_hole;
        let x = round(hole.x - breadboard.total_width / 2 + breadboard.config.hole_spacing / 2);
        let y = layer_offset + target_layer * layer_height;
        let z = round(-hole.y + breadboard.total_length / 2 - breadboard.config.hole_spacing / 2);
        let found;
        if (found = selected_holes.find(h => h.x == x && h.y == y && h.z == z)) {
            if (mode == "delete") {
                selected_holes = selected_holes.filter(h => h != found);
            }
            return;
        }
        if (mode == "create") {
            selected_holes.push({
                x: x,
                y: y,
                z: z,
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        mouse_down = false;
        can_select = true;
    }
}
function set_target_layer(val) {
    target_layer = val;
}
function render_holes() {
    linesgroup.clear();
    selected_holes.forEach((hole, i) => {
        let { x, y, z } = hole;
        y += breadboard_group.position.y;
        let radius = 0.5;
        if (i > 0) {
            let h1 = selected_holes[i - 1];
            let line_shape = line(
                new THREE.Vector3(h1.x, h1.y + radius + breadboard_group.position.y, h1.z),
                new THREE.Vector3(hole.x, hole.y + radius + breadboard_group.position.y, hole.z),
                radius,
                wire_material
            );
            linesgroup.add(line_shape);
        }

        let marker = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshMatcapMaterial({
            color: i == selected_holes.length - 1 ? 0xffaa00 : 0x00ff00,
            matcap: material.matcap
        }));
        marker.position.set(
            round(x, 2),
            y + radius,
            round(z, 2),
        );
        linesgroup.add(marker);
    });
}
/**
 * 
 * @param {THREE.Vector3} v1
 * @param {THREE.Vector3} v2
 * @param {number} radius
 * @param {THREE.MeshMatcapMaterial} mat
 * @returns 
 */
function line(v1, v2, radius, mat = material) {
    const length = dist(v1, v2);
    const cylinder = new Mesh(new CylinderGeometry(radius, radius, length), mat);
    cylinder.position.set(0, 0, length / 2); // zero the position
    cylinder.rotateX(degToRad(90)); // zero the rotation
    const group = new Group();
    group.add(cylinder);
    group.position.set(v1.x, v1.y, v1.z); // move group to start of line
    group.lookAt(v2); // rotate group to look at the end of the line
    return group;
}
function clear() {
    selected_holes = [];
}
function slice_wire() {
    let holes = JSON.parse(JSON.stringify(selected_holes));
    if (holes.length < 2) {
        console.error("Not enough holes");
        return;
    }
    let first = holes[0];
    let last = holes[holes.length - 1];
    holes.unshift({ x: first.x, y: -wire_depth + layer_offset, z: first.z });
    holes.push({ x: last.x, y: -wire_depth + layer_offset, z: last.z });
    const gcode = slice(holes);
    save("wire.gcode", gcode);
}