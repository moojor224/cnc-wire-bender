import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { dist, round, slice } from "./slicer.js";
import { manager } from "./breadboard_manager.js";

const canvas = document.getElementById("scene");
export const material = new THREE.MeshMatcapMaterial({
    color: 0xf9e94d,
    matcap: new THREE.TextureLoader().load("/generator/matcap-porcelain-white.jpg"),
    side: THREE.FrontSide,
});

// stats
const stats = new Stats();
stats.dom.style.position = "absolute";
stats.dom.style.top = "0px";
stats.dom.style.left = "0px";
document.body.append(stats.dom);

// scene
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x444444);

// camera
function makeCamera() {
    return new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100000);
}
let camera = makeCamera();
scene.add(camera);
camera.position.set(45, 45, 45);

// renderer
const renderer = new THREE.WebGLRenderer({
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
// scene.add(new THREE.AxesHelper(1000)); // positive axes
// scene.add(new THREE.AxesHelper(-1000)); // negative axes

// breadboard
let bo = manager.group;
let target_bo_position = 0;
scene.add(bo);
let fp = manager.faceplate;
let target_fp_opacity = 0;
let max_fp_opacity = 0.3;
scene.add(fp);

// cursor
const cursor = new THREE.Mesh(new THREE.SphereGeometry(), material);
cursor.visible = false;
scene.add(cursor);

// red cursor square
scene.add(manager.cursor);

let run = true;

// main animation loop
function animate() {
    if (run)
        requestAnimationFrame(animate);
    try {
        controls.update();
        renderer.render(scene, camera);
        stats.update();
        if (bo.position.y != target_bo_position) {
            bo.position.y += (target_bo_position - bo.position.y) * 0.2;
            // bo.position.y = target_bo_position
        }
        if (fp.material.opacity != target_fp_opacity) {
            fp.material.opacity += (target_fp_opacity - fp.material.opacity) * 0.2;
            // fp.material.opacity = target_fp_opacity;
        }
        manager.render_holes();
    } catch (err) {
        run = false;
        console.error(err);
    }
};


window.addEventListener("resize", function onWindowResize() {
    let [width, height] = [window.innerWidth, window.innerHeight];
    let { position: { x, y, z }, zoom } = camera;
    renderer.setSize(width, height);
    camera = makeCamera();
    controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(x, y, z);
    camera.zoom = zoom;
    renderer.render(scene, camera);
    camera.updateProjectionMatrix();
}, false);




canvas.addEventListener("mousemove", event => manager.mousemove(event, camera), false);

canvas.addEventListener("mousedown", manager.mousedown);
let linesgroup = manager.linesgroup;
scene.add(linesgroup);


canvas.addEventListener("mouseup", manager.mouseup);

animate();

document.getElementById("slice").addEventListener("click", manager.slice_wire);
document.getElementById("clear").addEventListener("click", manager.clear);

const layer_slider = document.getElementById("layer");
layer_slider.addEventListener("input", function () {
    let target_layer = parseInt(layer_slider.value);
    manager.set_target_layer(target_layer);
    target_bo_position = -target_layer * manager.breadboard.config.hole_spacing;
    if (target_layer == 0) {
        target_fp_opacity = 0;
    } else {
        target_fp_opacity = max_fp_opacity;
    }
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
window.save = save;

export function getLocalStorage(key, def) {
    let local = localStorage.getItem(key);
    if (local) {
        return JSON.parse(local);
    }
    return def;
}
