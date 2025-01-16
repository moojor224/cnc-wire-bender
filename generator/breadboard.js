/** @typedef {import("./types").BreadboardConfig} BreadboardConfig */
import * as three from "three";
import { BufferGeometryUtils, FontLoader as FL, Font, TextGeometry } from "three/examples/jsm/Addons.js";
const Three = three;
const THREE = three;

const material = new three.MeshMatcapMaterial({
    matcap: new three.TextureLoader().load("/generator/matcap-porcelain-white.jpg"),
    side: three.FrontSide,
    // side: three.DoubleSide,
});
/** @type {Font} */
const font = await new Promise(resolve => new FL().load("res/roboto_black_regular.typeface.json", function (font) {
    resolve(font);
}));
const fontGeometry = new TextGeometry("0123456789", {
    font: font,
    size: 2.54,
    depth: 0.01,
});
const fontMaterial = material.clone();
fontMaterial.color = new THREE.Color(0x000000);
const mesh = new THREE.Mesh(fontGeometry, fontMaterial);

// all of this shorthand is because I didn't want to have to type it all out every time
const { Group: G, Triangle: T, Vector3: V, MeshMatcapMaterial, Mesh } = three;
/** create a new vertice given an x, y, and z value */
const v = (a, b, c) => new V(a, b, c);
/** create a new triangle given 3 vertices */
const t = (a, b, c) => {
    const geometry = new three.BufferGeometry();
    geometry.setAttribute("position", new three.BufferAttribute(new Float32Array([
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

function lar(a) {
    console.log(...arguments);
    return a;
}


function extend(target, source) {
    Object.entries(target).forEach(([tKey, tValue]) => {
        if (source.hasOwnProperty(tKey)) {
            if (typeof tValue === "object" && !Array.isArray(tValue)) {
                console.log("extending", tKey, tValue, source[tKey]);
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
    };
    /** @type {BreadboardConfig} */
    config;
    /** @type {three.Group} */
    #group;
    #holes = [];
    #g = [];
    module_length = 0;
    total_length = 0;
    cursor;
    selected_hole = null;
    last_label = 0;
    /**
     * 
     * @param {BreadboardConfig} config 
     */
    constructor(config = {}) {
        console.groupCollapsed("breadboard");
        this.config = extend(copy(Breadboard.defaultConfig), copy(config || {}));
        this.module_length = Math.max(this.config.rows_per_section, this.config.power_rails.holes_per_section);
        this.#group = new G();
        this.insert_shell();
        let s = this.config.hole_spacing;
        this.cursor = new Mesh(new three.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        }));
        this.cursor.position.set(0, 0, 0.01);
        this.cursor.visible = false;
        this.#group.add(this.cursor);
        let power_rails = this.config.power_rails;
        let xOffset = 0;
        let yOffset = 0;
        for (let i = 0; i < this.config.num_sections; i++) {
            xOffset = 0;
            yOffset = i * this.module_length * s;
            this.insert_module(xOffset, yOffset);
        }
        this.#group.add(new Mesh(BufferGeometryUtils.mergeGeometries(this.#g), material));
        this.total_length = this.module_length * this.config.num_sections * s;
        this.total_width = (power_rails.enabled ? 2 * (power_rails.num_cols * s + power_rails.main_spacing * s) : 0) + this.config.num_subsections * this.config.holes_per_row * s + (this.config.num_subsections - 1) * this.config.subsection_spacing * s;
        console.groupEnd();
    }
    get object() {
        return this.#group;
    }
    #xOffset = 0;
    #yOffset = 0;

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
        return g;
    }

    // done
    insert_shell() {
        console.group("shell");
        let {
            hole_spacing: s,
            board_thickness: t,
            holes_per_row: r,
            num_sections: m,
            num_subsections: p,
            subsection_spacing: ss,
            power_rails: {
                enabled: e,
                num_cols: c,
                main_spacing: ms,
            }
        } = this.config;
        let l = this.module_length;
        let g = [];
        let length = l * s * m;
        let width = 0;
        if (e) {
            width += 2 * (c * s + ms * s);
        }
        width += r * s * p;
        width += (p - 1) * ss * s;
        g.push(q(v(0, 0, -t), v(0, length, -t), v(width, length, -t), v(width, 0, -t))); // floor
        g.push(q(v(0, 0, 0), v(0, length, 0), v(0, length, -t), v(0, 0, -t))); // left wall
        g.push(q(v(0, length, 0), v(width, length, 0), v(width, length, -t), v(0, length, -t))); // top wall
        g.push(q(v(width, length, 0), v(width, 0, 0), v(width, 0, -t), v(width, length, -t))); // right wall
        g.push(q(v(width, 0, 0), v(0, 0, 0), v(0, 0, -t), v(width, 0, -t))); // bottom wall
        let mesh = new Mesh(BufferGeometryUtils.mergeGeometries(g), material.clone());
        this.#group.add(mesh);
        console.log("successfullly inserted shell");
        console.groupEnd();
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
        if (enabled) x += lar(this.rail(xOffset + x, yOffset), "left rail");
        if (enabled && num_subsections > 0) x += lar(this.rail_spacer(xOffset + x, yOffset), "left rail spacer");
        for (let i = 0; i < num_subsections; i++) {
            if (i > 0) x += this.subsection_spacer(xOffset + x, yOffset);
            x += this.subsection(xOffset + x, yOffset);
        }
        if (enabled && num_subsections > 0) x += lar(this.rail_spacer(xOffset + x, yOffset), "right rail spacer");
        if (enabled) x += lar(this.rail(xOffset + x, yOffset), "right rail");
    }

    rail(xOff, yOff) {
        console.group("rail");
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
        console.log("successfullly inserted rail");
        console.groupEnd();
        return num_cols * s;
    }

    rail_spacer(xOff, yOff) {
        console.group("rail spacer");
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
        console.log("successfullly inserted rail spacer");
        console.groupEnd();
        return main_spacing * s;
    }

    subsection(xOff, yOff) {
        console.group("subsection");
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
        for (let x = 0; x < holes_per_row; x++) {
            for (let y = 0; y < rows_per_section; y++) {
                this.#g.push(...this.hole(x, y, xOff, yOff + pad_length));
            }
        }
        console.log("successfullly inserted subsection");
        console.groupEnd();
        return holes_per_row * s;
    }
    subsection_spacer(xOff, yOff) {
        console.group("subsection spacer");
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
        console.log("successfullly inserted subsection spacer");
        console.groupEnd();
        return subsection_spacing * s;
    }

    select_hole(x, y) {
        // console.log("select", round(x), round(y));
        let hole = this.#holes.find(h => (h.x <= x) && (h.x + h.width >= x) && (h.y <= y) && (h.y + h.height >= y));
        if (hole) {
            this.cursor.position.set(hole.x + hole.width / 2, hole.y + hole.height / 2, 0.01);
            this.cursor.visible = true;
            this.selected_hole = hole;
        } else {
            this.deselect_hole();
        }
    }

    deselect_hole() {
        this.cursor.visible = false;
        this.selected_hole = null;
    }
}
function round(n, p = 2) {
    return Math.round(n * Math.pow(10, p)) / Math.pow(10, p);
}