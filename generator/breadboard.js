/** @typedef {import("./types").BreadboardConfig} BreadboardConfig */
import * as THREE from "three";
import { BufferGeometryUtils, FontLoader as FL, Font, TextGeometry } from "three/examples/jsm/Addons.js";
import { scene } from "./index.js";

const material = new THREE.MeshMatcapMaterial({
    matcap: new THREE.TextureLoader().load("/generator/matcap-porcelain-white.jpg"),
    side: THREE.FrontSide,
});
/** @type {Font} */
const font = await new Promise(resolve => new FL().load("res/roboto_black_regular.typeface.json", function (font) {
    resolve(font);
}));
const fontMaterial = material.clone();
fontMaterial.color = new THREE.Color(0x000000);
setTimeout(function () { // testing 3d font
    const fontGeometry = new TextGeometry("0123456789", {
        font: font,
        size: 2.54,
        depth: 0.1,
    });
    const mesh = new THREE.Mesh(fontGeometry, fontMaterial);
    // scene.add(mesh);
});

// all of this shorthand is because I didn't want to have to type it all out every time
const { Group: G, Vector3: V, Mesh: M } = THREE;
/** create a new vertice given an x, y, and z value */
const v = (a, b, c) => new V(a, b, c);
/** create a new triangle given 3 vertices */
const t = (a, b, c) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
        a.x, a.y, a.z, // vertex 1
        b.x, b.y, b.z, // vertex 2
        c.x, c.y, c.z, // vertex 3
    ]), 3));
    geometry.computeVertexNormals();
    return geometry;
};
/** creates a new quadrilateral given 4 vertices */
const q = (a, b, c, d) => {
    let g = BufferGeometryUtils.mergeGeometries([t(a, b, c), t(a, c, d)])
    return g;
}


function extend(target, source) {
    Object.entries(target).forEach(([tKey, tValue]) => {
        if (source.hasOwnProperty(tKey)) {
            if (typeof tValue === "object" && !Array.isArray(tValue)) {
                extend(tValue, source[tKey]);
            } else {
                target[tKey] = source[tKey];
            }
        }
    });
    return target;
}

function copy(o) {
    return JSON.parse(JSON.stringify(o));
}

export class Breadboard {
    /** @type {BreadboardConfig} */
    static defaultConfig = {
        hole_spacing: 2.54,
        hole_inner_width: 1,
        hole_outer_width: 2,
        hole_inner_depth: 7,
        hole_outer_depth: 0.5,
        num_sections: 5,
        num_subsections: 2,
        subsection_spacing: 2,
        rows_per_section: 6,
        holes_per_row: 5,
        board_thickness: 9,
        power_rails: {
            enabled: true,
            num_cols: 2,
            holes_per_section: 5,
            main_spacing: 2,
        },
        labels: {
            enabled: true,
            start: 0,
            increment: 5,
        },
        num_breadboards_x: 1,
        num_breadboards_y: 1,
        breadboard_x_gap: 2,
        breadboard_y_gap: 2.5
    };
    /** @type {BreadboardConfig} */
    config;
    /** @type {THREE.Group} */
    #group;
    #holes = [];
    #g = [];
    module_length = 0;
    total_length = 0;
    cursor;
    selected_hole = null;
    last_labels = 0;
    /** @param {BreadboardConfig} config */
    constructor(config = {}) {
        this.config = extend(copy(Breadboard.defaultConfig), copy(config || {}));
        this.module_length = Math.max(this.config.rows_per_section, this.config.power_rails.holes_per_section);
        this.#group = new G();
        let s = this.config.hole_spacing;
        let power_rails = this.config.power_rails;
        let individual_width = ((power_rails.enabled ?
            2 * s * (power_rails.num_cols + power_rails.main_spacing) :
            0) +
            this.config.num_subsections * this.config.holes_per_row * s +
            (this.config.num_subsections - 1) * this.config.subsection_spacing * s);
        let individual_length = (this.module_length * this.config.num_sections * s);
        this.total_length = individual_length * this.config.num_breadboards_y +
            (this.config.breadboard_y_gap * s) * (this.config.num_breadboards_y);
        this.total_width = individual_width * this.config.num_breadboards_x +
            (this.config.breadboard_x_gap * s) * (this.config.num_breadboards_x);
        this.insert_shell();
        let xOffset = 0;
        let yOffset = 0;
        const t = this.config.board_thickness;
        const xmax = this.config.num_breadboards_x;
        const ymax = this.config.num_breadboards_y;
        const xgap = this.config.breadboard_x_gap;
        const ygap = this.config.breadboard_y_gap;
        for (let x = 0; x < xmax; x++) {
            for (let y = 0; y < ymax; y++) {
                this.last_labels = [];
                for (let i = 0; i < this.config.num_sections; i++) {
                    xOffset = x * ((xgap * s) + individual_width) + xgap * s / 2;
                    yOffset = i * this.module_length * s + y * ((ygap * s) + individual_length) + ygap * s / 2;
                    this.insert_module(xOffset, yOffset);
                }
                // insert horizontal spacers between breadboards
                if (this.config.breadboard_y_gap > 0 && y > 0) {
                    this.#g.push(q(
                        v(xOffset, ygap * s / 2 + (ygap * s * (y - 1)) + y * individual_length, 0),
                        v(xOffset + xgap * s * (x == xmax - 1 ? 0 : 1) + individual_width, ygap * s / 2 + (ygap * s * (y - 1)) + y * individual_length, 0),
                        v(xOffset + xgap * s * (x == xmax - 1 ? 0 : 1) + individual_width, ygap * s / 2 + (ygap * s * (y - 1)) + y * individual_length + this.config.breadboard_y_gap * s, 0),
                        v(xOffset, ygap * s / 2 + (ygap * s * (y - 1)) + y * individual_length + ygap * s, 0),
                    ));
                }
            }
            // insert vertical spacers between breadboards
            if (this.config.breadboard_x_gap > 0 && x > 0) {
                console.log("inserting spacer");
                this.#g.push(q(
                    v(xgap * s / 2 + (xgap * s * (x - 1)) + x * individual_width + xgap * s, ygap * s / 2, 0),
                    v(xgap * s / 2 + (xgap * s * (x - 1)) + x * individual_width + xgap * s, ygap * s / 2 + this.total_length - ygap * s, 0),
                    v(xgap * s / 2 + (xgap * s * (x - 1)) + x * individual_width, ygap * s / 2 + this.total_length - ygap * s, 0),
                    v(xgap * s / 2 + (xgap * s * (x - 1)) + x * individual_width, ygap * s / 2, 0),
                ));
            }
        }
        this.#g.push(
            q(
                v(0, 0, 0),
                v(this.total_width, 0, 0),
                v(this.total_width, ygap * s / 2, 0),
                v(0, ygap * s / 2, 0)
            ),
            q(
                v(0, ygap * s / 2, 0),
                v(xgap * s / 2, ygap * s / 2, 0),
                v(xgap * s / 2, this.total_length, 0),
                v(0, this.total_length, 0)
            ),
            q(
                v(this.total_width, this.total_length, 0),
                v(this.total_width - xgap * s / 2, this.total_length, 0),
                v(this.total_width - xgap * s / 2, 0, 0),
                v(this.total_width, 0, 0)
            ),
            q(
                v(0, ygap * s / -2 + this.total_length, 0),
                v(this.total_width, ygap * s / -2 + this.total_length, 0),
                v(this.total_width, this.total_length, 0),
                v(0, this.total_length, 0)
            ),
        );
        this.#group.add(new M(BufferGeometryUtils.mergeGeometries(this.#g), material));
        this.#group.add(new M(BufferGeometryUtils.mergeGeometries(this.#tg), fontMaterial));
    }
    get object() {
        return this.#group;
    }

    /**
     * @param {number} xCoord hole x coordinate
     * @param {number} yCoord hole y coordinate
     * @param {number} xOffset flat x offset
     * @param {number} yOffset flat y offset
     */
    hole(xCoord = 0, yCoord = 0, xOffset = 0, yOffset = 0) {
        let g = [];
        let {
            hole_spacing: s,
            hole_inner_width: iw,
            hole_outer_width: ow,
            hole_inner_depth: id,
            hole_outer_depth: od,
        } = this.config;
        let op = (s - ow) / 2;
        let ip = (s - iw) / 2;
        let [x, y] = [xOffset, yOffset];
        x += xCoord * s;
        y += yCoord * s;
        // rim
        g.push(q(v(x, y, 0), v(x + op, y + op, 0), v(x + op, y + s - op, 0), v(x, y + s, 0))); // left edge
        g.push(q(v(x, y + s, 0), v(x + op, y + s - op, 0), v(x + s - op, y + s - op, 0), v(x + s, y + s, 0))); // top edge
        g.push(q(v(x + s, y + s, 0), v(x + s - op, y + s - op, 0), v(x + s - op, y + op, 0), v(x + s, y, 0))); // right edge
        g.push(q(v(x + s, y, 0), v(x + s - op, y + op, 0), v(x + op, y + op, 0), v(x, y, 0))); // bottom edge
        // chamfer
        g.push(q(v(x + op, y + op, 0), v(x + ip, y + ip, -od), v(x + ip, y + s - ip, -od), v(x + op, y + s - op, 0))); // left chamfer
        g.push(q(v(x + ip, y + s - ip, -od), v(x + s - ip, y + s - ip, -od), v(x + s - op, y + s - op, 0), v(x + op, y + s - op, 0))); // top chamfer
        g.push(q(v(x + s - op, y + s - op, 0), v(x + s - ip, y + s - ip, -od), v(x + s - ip, y + ip, -od), v(x + s - op, y + op, 0))); // right chamfer
        g.push(q(v(x + s - ip, y + ip, -od), v(x + ip, y + ip, -od), v(x + op, y + op, 0), v(x + s - op, y + op, 0))); // bottom chamfer
        // hole walls
        g.push(q(v(x + ip, y + ip, -id), v(x + ip, y + s - ip, -id), v(x + ip, y + s - ip, -od), v(x + ip, y + ip, -od))); // left wall
        g.push(q(v(x + ip, y + s - ip, -id), v(x + s - ip, y + s - ip, -id), v(x + s - ip, y + s - ip, -od), v(x + ip, y + s - ip, -od))); // top wall
        g.push(q(v(x + s - ip, y + s - ip, -id), v(x + s - ip, y + ip, -id), v(x + s - ip, y + ip, -od), v(x + s - ip, y + s - ip, -od))); // right wall
        g.push(q(v(x + s - ip, y + ip, -id), v(x + ip, y + ip, -id), v(x + ip, y + ip, -od), v(x + s - ip, y + ip, -od))); // bottom wall
        // hole floor
        g.push(q(v(x + ip, y + ip, -id), v(x + s - ip, y + ip, -id), v(x + s - ip, y + s - ip, -id), v(x + ip, y + s - ip, -id))); // floor
        this.#holes.push({ x, y, width: s, height: s });

        this.#face_plate_holes.push(q(
            v(x + op, y + op, 0.1),
            v(x + op, y + s - op, 0.1),
            v(x + s - op, y + s - op, 0.1),
            v(x + s - op, y + op, 0.1)
        ));
        return g;
    }
    #face_plate = [];
    #face_plate_holes = [];
    /** @type {THREE.Mesh} */
    get face_plate() {
        // let plate = new M(BufferGeometryUtils.mergeGeometries(this.#face_plate), new THREE.MeshBasicMaterial(({
        //     color: 0xffffff,
        //     side: THREE.DoubleSide,
        //     transparent: true,
        //     opacity: 0,
        // })));
        let holes = new M(BufferGeometryUtils.mergeGeometries(this.#face_plate_holes), new THREE.MeshBasicMaterial(({
            color: 0x0000ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
        })));
        let group = new G();
        // group.add(plate);
        group.add(holes);
        return holes;
    }
    // done
    insert_shell() {
        const { board_thickness: t } = this.config;
        const g = [];
        const length = this.total_length;
        const width = this.total_width;
        const mat = material.clone();
        g.push(q(v(0, 0, -t), v(0, length, -t), v(width, length, -t), v(width, 0, -t))); // floor
        mat.color = new THREE.Color(0xffffff);
        mat.side = THREE.DoubleSide;
        mat.transparent = true;
        mat.opacity = 0.6;
        this.#face_plate.push(q(v(0, 0, 0), v(0, length, 0), v(width, length, 0), v(width, 0, 0))); // face plate
        g.push(q(v(0, 0, 0), v(0, length, 0), v(0, length, -t), v(0, 0, -t))); // left wall
        g.push(q(v(0, length, 0), v(width, length, 0), v(width, length, -t), v(0, length, -t))); // top wall
        g.push(q(v(width, length, 0), v(width, 0, 0), v(width, 0, -t), v(width, length, -t))); // right wall
        g.push(q(v(width, 0, 0), v(0, 0, 0), v(0, 0, -t), v(width, 0, -t))); // bottom wall
        let mesh = new M(BufferGeometryUtils.mergeGeometries(g), material.clone());
        this.#group.add(mesh);
    }

    insert_module(xOffset, yOffset) {
        let {
            config: {
                hole_spacing: s,
                num_subsections,
                power_rails: { enabled },
            },
        } = this;
        let x = 0;
        if (enabled) x += this.rail(xOffset + x, yOffset);
        if (enabled && num_subsections > 0) x += this.rail_spacer(xOffset + x, yOffset);
        for (let i = 0; i < num_subsections; i++) {
            if (i > 0) x += this.subsection_spacer(xOffset + x, yOffset);
            x += this.subsection(xOffset + x, yOffset, i);
        }
        if (enabled && num_subsections > 0) x += this.rail_spacer(xOffset + x, yOffset);
        if (enabled) x += this.rail(xOffset + x, yOffset);
    }

    rail(xOff, yOff) {
        let {
            config: {
                hole_spacing: s,
                power_rails: { main_spacing, num_cols, holes_per_section },
            },
            module_length,
        } = this;
        const pad_length = (module_length - holes_per_section) * s / 2;
        if (holes_per_section < module_length) {
            // insert top/bottom spacers
            this.#g.push(q(
                v(xOff, yOff, 0),
                v(xOff + num_cols * s, yOff, 0),
                v(xOff + num_cols * s, yOff + pad_length, 0),
                v(xOff, yOff + pad_length, 0),
            )); // bottom spacer
            this.#g.push(q(
                v(xOff, yOff + s * holes_per_section + pad_length, 0),
                v(xOff + num_cols * s, yOff + s * holes_per_section + pad_length, 0),
                v(xOff + num_cols * s, yOff + 2 * pad_length + s * holes_per_section, 0),
                v(xOff, yOff + 2 * pad_length + s * holes_per_section, 0),
            )); // bottom spacer
        }
        for (let x = 0; x < num_cols; x++) {
            for (let y = 0; y < holes_per_section; y++) {
                this.#g.push(...this.hole(x, y, xOff, yOff + pad_length));
            }
        }
        return num_cols * s;
    }

    rail_spacer(xOff, yOff) {
        let {
            config: {
                hole_spacing: s,
                power_rails: { main_spacing },
            },
            module_length,
        } = this;
        this.#g.push(q(
            v(xOff, yOff, 0),
            v(xOff + main_spacing * s, yOff, 0),
            v(xOff + main_spacing * s, yOff + module_length * s, 0),
            v(xOff, yOff + module_length * s, 0),
        ));
        return main_spacing * s;
    }
    last_labels = [];
    #tg = [];
    subsection(xOff, yOff, h_index) {
        let {
            config: {
                hole_spacing: s,
                holes_per_row,
                rows_per_section,
            },
            module_length,
        } = this;
        const pad_length = (module_length - rows_per_section) * s / 2;
        if (rows_per_section < module_length) {
            // insert top/bottom spacers
            this.#g.push(q(
                v(xOff, yOff, 0),
                v(xOff + holes_per_row * s, yOff, 0),
                v(xOff + holes_per_row * s, yOff + pad_length, 0),
                v(xOff, yOff + pad_length, 0),
            )); // bottom spacer
            this.#g.push(q(
                v(xOff, yOff + s * rows_per_section + pad_length, 0),
                v(xOff + holes_per_row * s, yOff + s * rows_per_section + pad_length, 0),
                v(xOff + holes_per_row * s, yOff + 2 * pad_length + s * rows_per_section, 0),
                v(xOff, yOff + 2 * pad_length + s * rows_per_section, 0),
            )); // bottom spacer
        }
        this.last_labels[h_index] = this.last_labels[h_index] || 1;
        for (let x = 0; x < holes_per_row; x++) {
            for (let y = 0; y < rows_per_section; y++) {
                this.#g.push(...this.hole(x, y, xOff, yOff + pad_length));
                if (x == holes_per_row - 1) {
                    let label = this.last_labels[h_index];
                    this.last_labels[h_index]++;
                    let text = new TextGeometry(label.toString(), {
                        font: font,
                        size: 1.27,
                        depth: 0.1,
                    });
                    text.deleteAttribute("uv");
                    text.translate(xOff + s * (x + 1), yOff + ((s / 2) - (1.27 / 2)) + y * s, 0);
                    this.#tg.push(text);
                }
            }
        }
        return holes_per_row * s;
    }
    subsection_spacer(xOff, yOff) {
        let {
            config: {
                hole_spacing: s,
                subsection_spacing,
                power_rails: { main_spacing },
            },
            module_length,
        } = this;
        this.#g.push(q(
            v(xOff, yOff, 0),
            v(xOff + subsection_spacing * s, yOff, 0),
            v(xOff + subsection_spacing * s, yOff + module_length * s, 0),
            v(xOff, yOff + module_length * s, 0),
        ));
        return subsection_spacing * s;
    }

    select_hole(x, y) {
        let hole = this.#holes.find(h => (h.x <= x) && (h.x + h.width >= x) && (h.y <= y) && (h.y + h.height >= y));
        if (hole) {
            // let world_pos = this.cursor.getWorldPosition(new V());
            // world_pos.z = 0.01;
            // this.cursor.position.set(hole.x + hole.width / 2, hole.y + hole.height / 2, this.cursor.worldToLocal(world_pos).z);
            // this.cursor.visible = true;
            this.selected_hole = hole;
        } else {
            this.deselect_hole();
        }
    }

    deselect_hole() {
        // this.cursor.visible = false;
        this.selected_hole = null;
    }
}
function round(n, p = 2) {
    return Math.round(n * Math.pow(10, p)) / Math.pow(10, p);
}