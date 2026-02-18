import * as Three from "three";

class Vector {
    constructor(x, y, z) {
        if (x instanceof Three.Vector3) {
            this._x = x.x;
            this._y = x.y;
            this._z = x.z;
        } else {
            this._x = x;
            this._y = y;
            this._z = z;
        }
        this.#update_length();
    }
    #update_length() {
        this.length = dist(this, new Three.Vector3(0, 0, 0));
    }
    set x(x) {
        this._x = x;
        this.#update_length();
    }
    set y(y) {
        this._y = y;
        this.#update_length();
    }
    set z(z) {
        this._z = z;
        this.#update_length();
    }
    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get z() {
        return this._z;
    }
}
