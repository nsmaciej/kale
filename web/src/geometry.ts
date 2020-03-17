// N.B. The origin is the top left corner.

export class Offset {
    static readonly zero = new Offset(0);

    constructor(readonly x: number, readonly y = x) {}

    static fromPage(e: { pageX: number; pageY: number }) {
        return new Offset(e.pageX, e.pageY);
    }
    static fromBoundingRect(rect: { left: number; top: number }) {
        return new Offset(rect.left, rect.top);
    }

    get neg() {
        return new Offset(-this.x, -this.y);
    }

    difference(other: Offset) {
        return this.add(other.neg);
    }
    add(other: Offset) {
        return new Offset(this.x + other.x, this.y + other.y);
    }
    scale(factor: number) {
        return new Offset(this.x * factor, this.y * factor);
    }

    lt(other: Offset) {
        return this.x < other.x && this.y < other.y;
    }
    gt(other: Offset) {
        return this.x > other.x && this.y > other.y;
    }

    hypot() {
        return Math.hypot(this.x, this.y);
    }
    distance(other: Offset) {
        return this.difference(other).hypot();
    }

    dx(d: number) {
        return new Offset(this.x + d, this.y);
    }
    dy(d: number) {
        return new Offset(this.x, this.y + d);
    }
}

export class Size {
    static readonly zero = new Size(0, 0);

    constructor(readonly width: number, readonly height = width) {}

    get bottomLeft(): Offset {
        return new Offset(0, this.height);
    }
    get bottomRight(): Offset {
        return new Offset(this.width, this.height);
    }
    get topRight(): Offset {
        return new Offset(this.width, 0);
    }

    pad({ x, y }: Offset) {
        return new Size(this.width + x, this.height + y);
    }

    padding({ top, right, bottom, left }: Padding) {
        return new Size(this.width + left + right, this.height + top + bottom);
    }

    isZero() {
        return this.width === 0 && this.height === 0;
    }

    extend(offset: Offset, size: Size): Size {
        return new Size(
            Math.max(this.width, offset.x + size.width),
            Math.max(this.height, offset.y + size.height),
        );
    }
}

export class Padding {
    constructor(
        readonly top: number,
        readonly right = top,
        readonly bottom = top,
        readonly left = right,
    ) {}

    get topLeft() {
        return new Offset(this.left, this.top);
    }

    get css() {
        return `${this.top}px ${this.right}px ${this.bottom}px ${this.left}px`;
    }

    contains(rhs: Padding) {
        return (
            rhs.bottom <= this.bottom &&
            rhs.left <= this.left &&
            rhs.right <= this.right &&
            rhs.top <= this.top
        );
    }
}

export class Rect {
    constructor(readonly origin: Offset, readonly size: Size) {}
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
        return new Rect(Offset.zero, this.size.pad(this.origin.neg));
    }
    get bottomRight() {
        return this.origin.add(new Offset(this.width, this.height));
    }

    withSize(size: Size) {
        return new Rect(this.origin, size);
    }

    contains(point: Offset) {
        const corner = this.size.bottomRight.add(this.origin);
        return this.origin.lt(point) && corner.gt(point);
    }

    pad(d: Offset) {
        return new Rect(this.origin.dy(-d.y).dx(-d.x), this.size.pad(d.scale(2)));
    }

    padding({ top, right, bottom, left }: Padding) {
        return new Rect(this.origin.dy(-top).dx(-left), this.size.pad(new Offset(right, bottom)));
    }

    shift(offset: Offset) {
        return new Rect(this.origin.add(offset), this.size);
    }
}
