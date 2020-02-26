// N.B. The origin is the top left corner.

export class Size {
    static readonly zero = new Size(0, 0);

    constructor(readonly width: number, readonly height = width) {}

    get bottom_left(): Vec {
        return new Vec(0, this.height);
    }
    get bottom_right(): Vec {
        return new Vec(this.width, this.height);
    }
    get top_right(): Vec {
        return new Vec(this.width, 0);
    }

    pad({ x, y }: Vec) {
        return new Size(this.width + x, this.height + y);
    }

    isZero() {
        return this.width === 0 && this.height === 0;
    }

    extend(offset: Vec, size: Size): Size {
        return new Size(
            Math.max(this.width, offset.x + size.width),
            Math.max(this.height, offset.y + size.height),
        );
    }
}

export class Rect {
    constructor(readonly origin: Vec, readonly size: Size) {}
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
    get atOrigin() {
        return new Rect(Vec.zero, this.size.pad(this.origin.neg));
    }
    get bottom_right() {
        return this.origin.add(new Vec(this.width, this.height));
    }

    withSize(size: Size) {
        return new Rect(this.origin, size);
    }

    contains(point: Vec) {
        const corner = this.size.bottom_right.add(this.origin);
        return this.origin.lt(point) && corner.gt(point);
    }

    pad(d: Vec) {
        return new Rect(this.origin.dy(-d.y).dx(-d.x), this.size.pad(d.scale(2)));
    }

    shift(offset: Vec) {
        return new Rect(this.origin.add(offset), this.size);
    }
}

export class Vec {
    static readonly zero = new Vec(0);

    constructor(readonly x: number, readonly y = x) {}

    static fromPage(e: { pageX: number; pageY: number }) {
        return new Vec(e.pageX, e.pageY);
    }
    static fromBoundingRect(rect: { left: number; top: number }) {
        return new Vec(rect.left, rect.top);
    }

    get neg() {
        return new Vec(-this.x, -this.y);
    }

    difference(other: Vec) {
        return this.add(other.neg);
    }
    add(other: Vec) {
        return new Vec(this.x + other.x, this.y + other.y);
    }
    scale(factor: number) {
        return new Vec(this.x * factor, this.y * factor);
    }

    lt(other: Vec) {
        return this.x < other.x && this.y < other.y;
    }
    gt(other: Vec) {
        return this.x > other.x && this.y > other.y;
    }

    hypot() {
        return Math.hypot(this.x, this.y);
    }
    distance(other: Vec) {
        return this.difference(other).hypot();
    }

    dx(d: number) {
        return new Vec(this.x + d, this.y);
    }
    dy(d: number) {
        return new Vec(this.x, this.y + d);
    }
}
