// N.B. The origin is the top left corner.

export class Size {
    static readonly zero = new Size(0, 0);

    constructor(readonly width: number, readonly height: number) {}

    get bottom_left(): Vector {
        return vec(0, this.height);
    }
    get top_right(): Vector {
        return vec(this.width, 0);
    }

    pad(d: number) {
        return size(this.width + d, this.height + d);
    }

    isZero() {
        return this.width == 0 && this.height == 0;
    }

    extend(offset: Vector, size: Size): Size {
        return new Size(
            Math.max(this.width, offset.x + size.width),
            Math.max(this.height, offset.y + size.height),
        );
    }
}

export class Vector {
    static readonly zero = new Vector(0, 0);

    constructor(readonly x: number, readonly y: number) {}

    static fromPage(e: { pageX: number; pageY: number }) {
        return vec(e.pageX, e.pageY);
    }

    difference(other: Vector) {
        return vec(this.x - other.x, this.y - other.y);
    }

    hypot() {
        return Math.hypot(this.x, this.y);
    }

    distance(other: Vector) {
        return this.difference(other).hypot();
    }

    dx(d: number) {
        return vec(this.x + d, this.y);
    }
    dy(d: number) {
        return vec(this.x, this.y + d);
    }
}

export function size(width: number, height: number) {
    return new Size(width, height);
}
export function vec(x: number, y: number) {
    return new Vector(x, y);
}
