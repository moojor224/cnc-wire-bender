import * as Three from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Breadboard } from "./breadboard.js";
import { dist, round, slice } from "./slicer.js";
let three = Three;
let THREE = Three;
let { Line3 } = three;

/**
 * 
 * @param {Three.Vector3} v1
 * @param {Three.Vector3} v2
 * @param {number} radius
 * @param {Three.MeshMatcapMaterial} mat
 * @returns 
 */
const line = (v1, v2, radius, mat = material) => {
    const length = dist(v1, v2);
    const cylinder = new Three.Mesh(new three.CylinderGeometry(radius, radius, length), mat);
    cylinder.position.set(0, 0, length / 2); // zero the position
    cylinder.rotateX(degrees(90)); // zero the rotation
    const group = new three.Group();
    group.add(cylinder);
    group.position.set(v1.x, v1.y, v1.z); // move group to start of line
    group.lookAt(v2); // rotate group to look at the end of the line
    return group;
}
const degrees = (deg) => deg * Math.PI / 180;
const canvas = document.getElementById("scene");
export const material = new three.MeshMatcapMaterial({
    color: 0xf9e94d,
    matcap: new three.TextureLoader().load("/generator/matcap-porcelain-white.jpg"),
    side: three.FrontSide,
});

// stats
const stats = new Stats();
stats.dom.style.position = "absolute";
stats.dom.style.top = "0px";
stats.dom.style.left = "0px";
document.body.append(stats.dom);

// scene
export const scene = new Three.Scene();
scene.background = new THREE.Color(0x444444);

// camera
function makeCamera() {
    return new Three.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100000);
    // return new Three.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -99999, 100000);
}
let camera = makeCamera();
scene.add(camera);
camera.position.set(45, 45, 45);
// camera.zoom = 10;
// camera.updateProjectionMatrix();

// renderer
const renderer = new three.WebGLRenderer({
    canvas: canvas,
    alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.clear();


// controls
let controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// axes
scene.add(new three.AxesHelper(1000)); // positive axes

// breadboard
let breadboard = new Breadboard();
let bo = breadboard.object;
bo.rotateX(degrees(-90));
bo.translateY(-breadboard.total_length / 2);
bo.translateX(-breadboard.total_width / 2);
// bo.position.y = -1;
scene.add(bo);
let fp = breadboard.face_plate;
fp.visible = false;
fp.rotateX(degrees(-90));
fp.translateY(-breadboard.total_length / 2);
fp.translateX(-breadboard.total_width / 2);
scene.add(fp);

// cursor
const cursor = new Three.Mesh(new Three.SphereGeometry(), material);
cursor.visible = false;
scene.add(cursor);

let s = breadboard.config.hole_spacing;
const cursor_square = new three.Mesh(new three.PlaneGeometry(s, s), new three.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
}));
cursor_square.rotateX(degrees(-90));
cursor_square.position.set(0, 0, 0.01);
cursor_square.visible = false;
scene.add(cursor_square);







// main animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    stats.update();
};

window.addEventListener("resize", function onWindowResize() {
    let [width, height] = [window.innerWidth, window.innerHeight];
    let { position: { x, y, z }, zoom } = camera;
    renderer.setSize(width, height);
    camera = makeCamera();
    controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(x, y, z);
    camera.zoom = zoom;
    // window.camera = camera;
    renderer.render(scene, camera);
    camera.updateProjectionMatrix();
}, false);



let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let intersects = new THREE.Vector3();

canvas.addEventListener("mousemove", function (event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, intersects);
    cursor.position.set(intersects.x, intersects.y, intersects.z);
    // console.log(cursor.position);
    let x = cursor.position.x + breadboard.total_width / 2;
    let y = -cursor.position.z + breadboard.total_length / 2;
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
        // console.log(hole.x + hole.width / 2, hole.y + hole.height / 2, 0.1);
        cursor_square.position.set(
            hole.x + hole.width / 2 - breadboard.total_width / 2,
            0.2,
            -(hole.y + hole.height / 2) + breadboard.total_length / 2
        );
        cursor_square.visible = true;
    } else {
        cursor_square.visible = false;
    }
}, false);
let can_select = true, mouse_down = false;
let selected_holes = [
    { "x": -3.81, "y": 0.1, "z": 36.83 }, // spiral
    { "x": -8.89, "y": 0.1, "z": 34.29 },
    { "x": -8.89, "y": 5.18, "z": 31.75 },
    { "x": -3.81, "y": 5.18, "z": 29.21 },
    { "x": -3.81, "y": 0.1, "z": 26.67 },
    { "x": -8.89, "y": 0.1, "z": 24.13 },
    { "x": -8.89, "y": 5.18, "z": 21.59 },
    { "x": -3.81, "y": 5.18, "z": 19.05 },
    { "x": -3.81, "y": 0.1, "z": 16.51 },
    { "x": -8.89, "y": 0.1, "z": 13.97 },
    { "x": -8.89, "y": 5.18, "z": 11.43 },
    { "x": -3.81, "y": 5.18, "z": 8.89 },
    { "x": -3.81, "y": 0.1, "z": 6.35 },
    { "x": -8.89, "y": 0.1, "z": 3.81 },
    { "x": -8.89, "y": 5.18, "z": 1.27 },
    { "x": -3.81, "y": 5.18, "z": -1.27 },
    { "x": -3.81, "y": 0.1, "z": -3.81 },
    { "x": -8.89, "y": 0.1, "z": -6.35 },
    { "x": -8.89, "y": 5.18, "z": -8.89 },
    { "x": -3.81, "y": 5.18, "z": -11.43 },
    { "x": -3.81, "y": 0.1, "z": -13.97 },
    { "x": -8.89, "y": 0.1, "z": -16.51 },
    { "x": -8.89, "y": 5.18, "z": -19.05 },
    { "x": -3.81, "y": 5.18, "z": -21.59 },
    { "x": -3.81, "y": 0.1, "z": -24.13 },
    { "x": -8.89, "y": 0.1, "z": -26.67 },
    { "x": -8.89, "y": 5.18, "z": -29.21 },
    { "x": -3.81, "y": 5.18, "z": -31.75 },
    { "x": -3.81, "y": 0.1, "z": -34.29 },
    { "x": -8.89, "y": 0.1, "z": -36.83 }
];
window.selected_holes = selected_holes;
canvas.addEventListener("mousedown", function (event) {
    mouse_down = true;
});
let linesgroup = new Three.Group();
scene.add(linesgroup);
let wire_material = material.clone();
wire_material.color = new Three.Color(0xff0000);

let target_layer = 0;
const layer_height = 2.54;
const layer_offset = 0.1;

canvas.addEventListener("mouseup", function (event) {
    let mode = "create";
    if (event.button == 2) mode = "delete";
    try {
        if (!can_select) {
            // throw new Error("Cannot select hole");
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
                window.selected_holes = selected_holes;
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
        can_select = true;
        mouse_down = false;
        render_holes();
    }
});
function render_holes() {
    linesgroup.clear();
    selected_holes.forEach((hole, i) => {
        let { x, y, z } = hole;
        const y_offset = target_layer * layer_height;
        y -= y_offset;
        let radius = 0.5;
        if (i > 0) {
            let h1 = selected_holes[i - 1];
            let line_shape = line(
                new Three.Vector3(h1.x, h1.y + radius - y_offset, h1.z),
                new Three.Vector3(hole.x, hole.y + radius - y_offset, hole.z),
                radius,
                wire_material
            );
            linesgroup.add(line_shape);
        }

        let marker = new Three.Mesh(new Three.SphereGeometry(1), new THREE.MeshMatcapMaterial({
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
function clear() {
    selected_holes = [];
    window.selected_holes = selected_holes;
    render_holes();
}
render_holes();
animate();

const wire_depth = 3;
function slice_wire() {
    let holes = JSON.parse(JSON.stringify(selected_holes));
    if (holes.length < 2) {
        console.error("Not enough holes");
        return;
    }
    let first = holes[0];
    let last = holes[holes.length - 1];
    holes.unshift({ x: first.x, y: -wire_depth, z: first.z });
    holes.push({ x: last.x, y: -wire_depth, z: last.z });
    const gcode = slice(holes);
    save("wire.gcode", gcode);
}
window.slice_wire = slice_wire;
document.getElementById("slice").addEventListener("click", slice_wire);
document.getElementById("clear").addEventListener("click", clear);

const layer_slider = document.getElementById("layer");
layer_slider.addEventListener("input", function () {
    target_layer = parseInt(layer_slider.value);
    bo.position.y = -target_layer * layer_height;
    if (target_layer == 0) {
        fp.visible = false;
    } else {
        fp.visible = true;
    }
    render_holes();
});
document.getElementById("layer-add").addEventListener("click", () => {
    layer_slider.value = parseInt(layer_slider.value) + 1;
    layer_slider.dispatchEvent(new Event("input"));
});
document.getElementById("layer-minus").addEventListener("click", () => {
    layer_slider.value = parseInt(layer_slider.value) - 1;
    layer_slider.dispatchEvent(new Event("input"));
});
layer_slider.dispatchEvent(new Event("input"));

function save(name, string) {
    let a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([string], { type: "text/plain" }));
    a.setAttribute("download", name);
    a.click();
    a.remove();
}