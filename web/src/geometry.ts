// N.B. The origin is the top left corner.

export class Size {
    static readonly zero = new Size(0, 0);

    constructor(readonly width: number, readonly height: number) {}

    get bottom_left(): Vector {
        return vec(0, this.height);
    }
    get bottom_right(): Vector {
        return vec(this.width, this.height);
    }
    get top_right(): Vector {
        return vec(this.width, 0);
    }

    pad({ x, y }: Vector) {
        return size(this.width + x, this.height + y);
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

export class Rect {
    constructor(readonly origin: Vector, readonly size: Size) {}
    get x() {
        return this.origin.x;
    }
    get y() {
        return this.origin.y;
    }
    get width() {
        return this.size.width;
    }
    get height() {
        return this.size.height;
    }

    contains(point: Vector) {
        const corner = this.size.bottom_right.add(this.origin);
        return this.origin.lt(point) && corner.gt(point);
    }

    pad(d: Vector) {
        return new Rect(this.origin.dy(-d.y).dx(-d.x), this.size.pad(d).pad(d));
    }

    shift(offset: Vector) {
        return new Rect(this.origin.add(offset), this.size);
    }
}

export class Vector {
    static readonly zero = new Vector(0, 0);

    constructor(readonly x: number, readonly y: number) {}

    static fromPage(e: { pageX: number; pageY: number }) {
        return vec(e.pageX, e.pageY);
    }
    static fromBoundingRect(rect: { left: number; top: number }) {
        return vec(rect.left, rect.top);
    }

    difference(other: Vector) {
        return vec(this.x - other.x, this.y - other.y);
    }
    add(other: Vector) {
        return vec(this.x + other.x, this.y + other.y);
    }

    lt(other: Vector) {
        return this.x < other.x && this.y < other.y;
    }
    gt(other: Vector) {
        return this.x > other.x && this.y > other.y;
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
