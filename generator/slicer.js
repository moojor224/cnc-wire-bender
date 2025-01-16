// Slicer class derived from https://github.com/SphaeroX/Javascript-G-Code-Generator/blob/main/slicer.class.js

import { Group, Mesh, Sphere, SphereGeometry, Vector3 } from "three";
import { radToDeg } from "three/src/math/MathUtils.js";

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

export const dist = (v1, v2) => ((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2 + (v1.z - v2.z) ** 2) ** 0.5;
// export const dist2 = (v1, v2) => new Vector3().subVectors(v1, v2).length();
export const round = (num) => Math.round(num * 100) / 100;
class Slicer {
    /**
     * 
     * @param {number} nozzleDiameter 
     * @param {number} layerHeight 
     * @param {number} filamentDiameter 
     * @param {number} movementSpeed 
     * @param {number} extrudeSpeed 
     * @param {number} heightSpeed 
     * @param {number} retractSpeed 
     * @param {number} retractLength 
     */
    constructor(movementSpeed = 2000, extrudeSpeed = 1000) {
        this.movementSpeed = movementSpeed;
        this.extrudeSpeed = extrudeSpeed;
        this.currentPosition = { x: null, y: null, z: null, e: null };
        this.gcode = "";
        this.gcode += "M211 S0 ; disable software endstops\n";
        this.gcode += "G92 E0 X0 Y0 Z0 ; set current position as home\n";
        this.gcode += "G91 ; set relative positioning\n";
        this.gcode += "\n";
        this.status("yellow");
    }
    /** adds a line of movement gcode with a speed */
    addGcodeLine(gcode, speed) {
        this.gcode += `${gcode} F${speed}\n`;
    }
    /** move extruder by the specified amount */
    extrude(length, speed = this.extrudeSpeed) {
        this.addGcodeLine(`G1 E${length}`, speed);
        this.currentPosition.e += length;
    }
    /** move x, y, z axes with a speed */
    move(x = 0, y = 0, z = 0, speed = this.movementSpeed) {
        this.addGcodeLine(`G0 X${x} Y${y} Z${z}`, speed);
        this.currentPosition.z += z;
        this.currentPosition.x += x;
        this.currentPosition.y += y;
    }
    /** move servo to angle. limited to 0-180 degrees */
    moveServo(angle) {
        this.gcode += `M280 P0 S${angle}\n`;
    }
    cutWire() {
        this.comment("cut wire");
        this.status("red");
        this.moveServo(90);
        this.moveServo(0);
        this.status("yellow");
    }

    /**
     * sets the color of the status light
     * @param {"blue" | "yellow" | "red" | "green"} color status light color
     */
    status(color) {
        this.comment("status: " + color + "\n");
        switch (color) {
            case "blue": return this.neopixel({ b: 255 });
            case "yellow": return this.neopixel({ r: 255, g: 255 });
            case "red": return this.neopixel({ r: 255 });
            case "green": return this.neopixel({ g: 255 });
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

    /** cut wire and set status light to green */
    finish() {
        this.wait();
        this.cutWire();
        this.status("green");
        this.fan(0);
    }
    wait() {
        this.comment("waiting for moves to finish");
        this.gcode += "M400\n";
    }

    comment(text) {
        this.gcode += `; ${text}\n`;
    }
    fan(speed) {
        this.gcode += `\M106 S${speed}\n`;
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
 * @param {position[]} positions 
 */
export function slice(positions) {
    console.clear();
    const slicer = new Slicer();
    let lines = new Array(positions.length - 1).fill(0).map((_, i) => {
        let l = {
            start: new Vector3(...arrify(positions[i])),
            end: new Vector3(...arrify(positions[i + 1])),
            length: round(dist(positions[i], positions[i + 1])),
            abs: new Vector3(),
        };
        l.abs = new Vector3().subVectors(l.start, l.end);
        return l;
    });
    lines = lines.map((e, i) => {
        if (i > 1) {
            let curLine = new Vector3().subVectors(e.start, e.end);
            let lastLine = new Vector3().subVectors(lines[i - 1].start, lines[i - 1].end);
            if (areVectorsParallel(curLine, lastLine)) {
                lines[i - 1].end = e.end;
                lines[i - 1].length += e.length;
                return null;
            }
        }
        return e;
    }).filter(e => e);
    console.log("lines", lines);
    slicer.status("yellow"); // status: working
    slicer.fan(100);
    lines.forEach((line, i) => {
        slicer.comment("segment " + (i + 1));
        if (i == 0) {
            slicer.extrude(line.length);
        } else if (i == 1) {
            let bend_angle = radToDeg(angle(line.start, line.end, lines[i + 1].end));
            slicer.move(0, bend_angle);
            slicer.move(0, -bend_angle);
            slicer.extrude(line.length);
        } else {
            let origin = lines[i - 1].start.clone();
            let group = new Group();
            group.position.set(...arrify(origin));
            group.lookAt(line.end);
            let a2_start = new Mesh(new SphereGeometry());
            a2_start.position.set(...arrify(lines[i - 2].start.clone()));
            let a2_end = new Mesh(new SphereGeometry());
            a2_end.position.set(...arrify(lines[i - 2].end.clone()));
            let cur_end = new Mesh(new SphereGeometry());
            cur_end.position.set(...arrify(line.end.clone()));
            group.add(a2_start, a2_end, cur_end);
            group.position.set(0, 0, 0);
            group.lookAt(0, 1, 0);
            cur_end.position.y = 0;
            a2_end.position.y = 0;
            a2_start.position.y = 0;
            console.log(cur_end.position, a2_end.position, a2_start.position);
            let rotation_angle = radToDeg(angle(cur_end.position, a2_end.position, a2_start.position));
            console.log("rotation_angle " + i, rotation_angle);
            let bend_angle = radToDeg(angle(lines[i - 1].start, line.start, line.end));
            console.log("bend_angle " + i, bend_angle);
            slicer.move(rotation_angle); // rotate bender
            slicer.move(0, bend_angle); // bend bender
            slicer.move(0, -bend_angle); // un-dend bender
        }
    });
    slicer.finish();
    console.log(slicer.getGcode());
}

/**
 * @param {Vector3} A
 * @param {Vector3} B this one is the vertex
 * @param {Vector3} C
 * @returns
 */
function angle(A, B, C) {
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

/*
wire shape:
      \ 0
       \
        \
         \
2 --------\ 1
\
 \
  \
   \
    \ 3


points:
0: -1, 1, 0
1: 0, 0, 1
2: 0, 0, 3
3: 1, -1, 2

bend n is point n-1 to point n+1


bend 0 is easy, just extrude the length of wire,
bend 1 should also be easy, just bend the wire at the angle of the first bend (angle 0,1,2)

to figure out bend 2:
move line 0,1 to where 1 matches with point 2, find the angle of 0,1/2,3, this difference should be the bending jig angle
find the angle of 1,2,3. this should be bending angle amount

to figure out bend 3:
move line 1,2 to where 2 matches with point 3, find the angle of 1,2/3,4, this difference should be the bending jig angle
find the angle of 2,3,4. this should be bending angle amount

etc.
last bend should just be extrude the length

*/

