// Slicer class derived from https://github.com/SphaeroX/Javascript-G-Code-Generator/blob/main/slicer.class.js

import { Group, Mesh, Object3D, SphereGeometry, Vector2, Vector3 } from "three";
import { radToDeg } from "three/src/math/MathUtils.js";
import { scene } from "./index.js";

/**
 *
 * @param {Vector3} v1
 * @param {Vector3} v2
 * @returns {boolean}
 */
function areVectorsParallel(v1, v2) {
    // Check if either vector is zero, which is considered parallel to any vector
    if (v1.length() === 0 || v2.length() === 0) {
        return true;
    }

    // Calculate the cross product of the two vectors
    const crossProduct = new Vector3().crossVectors(v1, v2);

    // If the cross product is zero, the vectors are parallel
    return crossProduct.lengthSq() === 0;
}

// export const dist = (v1, v2) => ((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2 + (v1.z - v2.z) ** 2) ** 0.5;
export const dist = (v1, v2) => new Vector3().subVectors(v1, v2).length();
export const round = (num) => Math.round(num * 100) / 100;
class Machine {
    constructor(movementSpeed = 3000, extrudeSpeed = 1000) {
        this.movementSpeed = movementSpeed;
        this.extrudeSpeed = extrudeSpeed;
        this.currentPosition = { x: null, y: null, z: null, e: null };
        this.gcode = "";
        this.gcode += "M211 S0 ; disable software endstops\n";
        this.gcode += "G92 E0 X0 Y0 Z0 ; set current position as home\n";
        this.gcode += "G91 ; set relative positioning\n\n";
        this.status("yellow");
    }
    /** adds a line of movement gcode with a speed */
    addGcode(gcode, speed, comment = "") {
        this.gcode += `${gcode} F${speed}${comment ? " ; " + comment : ""}\n`;
    }
    /** move extruder by the specified amount */
    extrude(e, speed = this.extrudeSpeed) {
        console.log("extrude", e);
        e = round(e);
        this.addGcode(`G1 E${e}`, speed, "extrude");
        this.currentPosition.e += e;
    }
    /** move x, y, z axes with a speed */
    move(x = 0, y = 0, z = 0, speed = this.movementSpeed) {
        console.log("move", { x, y, z, speed });
        function filter(axis, value) {
            return value === 0 ? "" : " " + axis + value;
        }
        x = round(x);
        y = round(y);
        z = round(z);
        this.addGcode(`G0${filter("X", x)}${filter("Y", y)}${filter("Z", z)}`, speed, "move");
        this.currentPosition.x += x;
        this.currentPosition.y += y;
        this.currentPosition.z += z;
    }
    /** move servo to angle. limited to 0-180 degrees */
    moveServo(angle) {
        this.gcode += `M280 P0 S${angle} ; move servo\n`;
    }

    /**
     * sets the color of the status light
     * @param {"blue" | "yellow" | "red" | "green"} color status light color
     */
    status(color) {
        this.comment("status: " + color);
        switch (color) {
            case "blue":
                return this.neopixel({ b: 255 });
            case "yellow":
                return this.neopixel({ r: 255, g: 255 });
            case "red":
                return this.neopixel({ r: 255 });
            case "green":
                return this.neopixel({ g: 255 });
        }
    }

    /**
     * set to blue when powered on\
     * set to yellow when working\
     * set to red when cutting\
     * set to green when done
     * @param {number} strip which strip to control
     * @param {number} index which pixel to control
     * @param {number} r red
     * @param {number} g green
     * @param {number} b blue
     * @param {number} brightness brightness
     */
    neopixel({ strip = 0, index = 0, r = 0, g = 0, b = 0, brightness = 80 }) {
        this.gcode += `M150 S${strip} I${index} R${r} U${g} B${b} P${brightness} K\n`;
    }
    enable_steppers() {
        this.gcode += "M17 ; enable stepper motors\n";
    }
    disable_steppers() {
        this.gcode += "M18 ; disable stepper motors\n";
    }
    wait() {
        this.gcode += "M400 ; waiting for moves to finish\n";
    }
    comment(text) {
        this.gcode += `; ${text}\n`;
    }
    fan(speed) {
        this.gcode += `\M106 S${speed}\n`;
    }
    cutWire() {
        this.comment("cut wire");
        this.status("red");
        this.moveServo(90);
        this.moveServo(0);
        this.status("yellow");
    }
    /** end the slicing and run cleanup gcode */
    finish() {
        this.wait();
        this.moveServo(1); // add a small delay to let extruder finish (just in case)
        this.cutWire();
        // protection for wires wrapping around the bender. technically, this should never happen
        let x_amount = this.currentPosition.x;
        while (x_amount > 360) x_amount -= 360;
        while (x_amount < -360) x_amount += 360;
        if (x_amount != this.currentPosition.x) {
            this.comment("unwrap wires from bender");
            this.move(round(x_amount - this.currentPosition.x));
        }
        this.wait();
        this.disable_steppers();
        this.status("green");
        this.fan(0);
        console.log(this);
    }
    /** returns raw gcode */
    getGcode() {
        return this.gcode;
    }
}

/**
 * @typedef position
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * converts a vector into an array of its components: {x,y,z} => [x,y,z]
 * @param {Vector3} v
 * @returns {number[]}
 */
const arrify = (v) => [v.x, v.y, v.z];
/**
 *
 * @param {Object3D} obj
 */
function zero(obj) {
    let vec = new Vector3();
    obj.getWorldPosition(vec);
    vec.y = 0;
    scene.attach(obj);
    obj.position.set(...arrify(vec));
}
/**
 *
 * @param {position[]} positions
 */
export function slice(positions) {
    const machine = new Machine(6000);
    machine.enable_steppers();
    let lines = new Array(positions.length - 1).fill(0).map((_, i) => {
        let l = {
            start: new Vector3(...arrify(positions[i])),
            end: new Vector3(...arrify(positions[i + 1])),
            length: round(dist(positions[i], positions[i + 1]))
        };
        l.abs = new Vector3().subVectors(l.start, l.end);
        return l;
    });
    lines = lines
        .map((e, i) => {
            if (i > 1) {
                let curLine = new Vector3().subVectors(e.start, e.end);
                let lastLine = new Vector3().subVectors(lines[i - 1].start, lines[i - 1].end);
                if (areVectorsParallel(curLine, lastLine)) {
                    // combine parallel lines
                    lines[i - 1].end = e.end;
                    lines[i - 1].length += e.length;
                    return null;
                }
            }
            return e;
        })
        .filter((e) => e);
    machine.status("yellow"); // status: working
    machine.fan(180);
    lines.forEach((line, i) => {
        machine.comment("segment " + (i + 1));
        if (i == 1) {
            let bend_angle = radToDeg(angle3d(line.start, line.end, lines[i + 1].end));
            // console.log("bend ", bend_angle);
            machine.move(0, bend_angle);
            machine.move(0, -bend_angle);
        } else if (i > 1) {
            let origin = lines[i - 1].start.clone();
            let group = new Group();
            group.position.add(origin);
            group.lookAt(lines[i - 1].end.clone());

            let a2_start = new Mesh(new SphereGeometry());
            a2_start.position.add(lines[i - 2].start.clone());

            let a2_end = new Mesh(new SphereGeometry());
            a2_end.position.add(lines[i - 2].end.clone());

            let cur_end = new Mesh(new SphereGeometry());
            cur_end.position.add(line.end.clone());

            group.attach(a2_start); // attach points to group
            group.attach(a2_end);
            group.attach(cur_end);

            group.position.set(0, 0, 0); // zero position of group
            group.lookAt(0, 1, 0); // normalize group position

            zero(cur_end);
            zero(a2_end);
            zero(a2_start);

            group.attach(a2_start);
            group.attach(a2_end);
            group.attach(cur_end);

            let rotation_angle = radToDeg(
                angle2d(
                    cur_end.getWorldPosition(new Vector3()),
                    a2_end.getWorldPosition(new Vector3()),
                    a2_start.getWorldPosition(new Vector3())
                )
            );
            let bend_angle = radToDeg(angle3d(lines[i - 1].start, line.start, line.end));
            machine.move(rotation_angle); // rotate bender
            machine.move(0, bend_angle); // bend bender
            machine.move(0, -bend_angle); // un-bend bender
        }
        machine.extrude(line.length);
    });
    machine.finish();
    const gcode = machine.getGcode();
    return gcode;
}

/**
 * @param {Vector3} A
 * @param {Vector3} B this one is the vertex
 * @param {Vector3} C
 * @returns
 */
function angle3d(A, B, C) {
    let v2 = { x: A.x - B.x, y: A.y - B.y, z: A.z - B.z };
    let v1 = { x: B.x - C.x, y: B.y - C.y, z: B.z - C.z };
    let v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    let v1norm = { x: v1.x / v1mag, y: v1.y / v1mag, z: v1.z / v1mag };

    let v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    let v2norm = { x: v2.x / v2mag, y: v2.y / v2mag, z: v2.z / v2mag };
    let dotp = v1norm.x * v2norm.x + v1norm.y * v2norm.y + v1norm.z * v2norm.z;
    let angle = Math.acos(dotp);
    return angle;
}
function angle2d(A, B, C) {
    let v1 = new Vector2(A.x - B.x, A.z - B.z);
    let v2 = new Vector2(C.x - B.x, C.z - B.z);

    let dotp = v1.x * v2.x + v1.y * v2.y;
    let det = v1.x * v2.y - v1.y * v2.x;
    let angle = Math.atan2(det, dotp);
    return angle;
}
