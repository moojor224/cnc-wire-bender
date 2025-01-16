import * as Three from "three";
import { OrbitControls, FontLoader, TextGeometry, LineMaterial, Line2, LineGeometry } from "three/examples/jsm/Addons.js";
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
const material = new three.MeshMatcapMaterial({
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
const scene = new Three.Scene();
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
scene.add(bo);

// cursor
const cursor = new Three.Mesh(new Three.SphereGeometry(), material);
cursor.visible = false;
scene.add(cursor);









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
}, false);
let can_select = true, mouse_down = false;
let selected_holes = [{ "x": -6.35, "y": 0.1, "z": 31.75 }, { "x": -6.35, "y": 0.1, "z": 24.13 }];
window.selected_holes = selected_holes;
canvas.addEventListener("mousedown", function (event) {
    mouse_down = true;
});
let linesgroup = new Three.Group();
scene.add(linesgroup);
let wire_material = material.clone();
wire_material.color = new Three.Color(0xff0000);
canvas.addEventListener("mouseup", function (event) {
    try {
        if (!can_select) throw new Error("Cannot select hole");
        if (!breadboard.selected_hole) throw new Error("No hole selected");
        console.log("clicked hole");
        let hole = breadboard.selected_hole;
        let x = round(hole.x - breadboard.total_width / 2 + breadboard.config.hole_spacing / 2);
        let y = round(0.1);
        let z = round(-hole.y + breadboard.total_length / 2 - breadboard.config.hole_spacing / 2);
        let last_hole = selected_holes[selected_holes.length - 1];
        if (last_hole) {
            if (last_hole.x == x && last_hole.y == y && last_hole.z == z) {
                console.log("same hole");
                return;
            }
        }
        selected_holes.push({
            x: x,
            y: y,
            z: z,
        });
        render_holes();
    } catch (e) {
        console.error(e);
    }
    can_select = true;
    mouse_down = false;
});
function render_holes() {
    linesgroup.clear();
    selected_holes.forEach((hole, i) => {
        let { x, y, z } = hole;
        let radius = 0.5;
        if (i > 0) {
            let h1 = selected_holes[i - 1];
            let line_shape = line(
                new Three.Vector3(h1.x, h1.y + radius, h1.z),
                new Three.Vector3(hole.x, hole.y + radius, hole.z),
                radius,
                wire_material
            );
            linesgroup.add(line_shape);
        }

        let marker = new Three.Mesh(new Three.SphereGeometry(1), new THREE.MeshMatcapMaterial({ color: 0x00ff00, matcap: material.matcap }));
        marker.position.set(
            round(x, 2),
            y + radius,
            round(z, 2),
        );
        linesgroup.add(marker);
    });
}
render_holes();
animate();

document.getElementById("slicebtn")?.addEventListener("click", function () {
    /** @type {import("./slicer.js").position[]} */
    let holes = JSON.parse(JSON.stringify(selected_holes));
});
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
    slice(holes);
}
window.slice_wire = slice_wire;
document.getElementById("slice").addEventListener("click", slice_wire);