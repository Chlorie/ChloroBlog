export type Vec2 = [number, number];

export enum Color {
	DEFAULT = "default",
	RED = "red",
	BLUE = "blue",
}

export enum PointType {
	PIECE = "piece",
	MARKER = "marker",
}

export enum LineType {
	SEGMENT = "segment",
	EXTENDED = "extended",
}

function getColorClasses(color: Color, isFill = false): string {
	switch (color) {
		case Color.DEFAULT:
			return isFill
				? "fill-slate-800 dark:fill-slate-300"
				: "stroke-slate-800 dark:stroke-slate-300";
		case Color.RED:
			return isFill
				? "fill-rose-600 dark:fill-rose-400"
				: "stroke-rose-600 dark:stroke-rose-400";
		case Color.BLUE:
			return isFill
				? "fill-blue-600 dark:fill-blue-500"
				: "stroke-blue-600 dark:stroke-blue-500";
	}
}

export class Plot {
	constructor(
		readonly size: number,
		readonly scale: number,
		private readonly extraGrid: number,
		private readonly extraSpace: number,
	) {
		const dim = (size + 2 * extraSpace) * scale;
		this.imageSize = dim;
	}

	readonly imageSize: number;

	applyTransform(coords: Vec2): Vec2 {
		return [
			(coords[0] + this.extraSpace) * this.scale,
			this.imageSize - (coords[1] + this.extraSpace) * this.scale,
		];
	}

	renderGrid(): string {
		const min = this.applyTransform([-this.extraGrid, 0])[0];
		const max = this.applyTransform([this.size + this.extraGrid, 0])[0];
		const CLASSES = "stroke-1 stroke-neutral-800/50 dark:stroke-neutral-100/50";
		return Array.from({ length: this.size + 1 })
			.map((_, i) => {
				const current = this.applyTransform([0, i])[1];
				return `
                    <line class="${CLASSES}" x1=${min} y1=${current} x2=${max} y2=${current} />
                    <line class="${CLASSES}" x1=${current} y1=${min} x2=${current} y2=${max} />
                `;
			})
			.join("");
	}
}

export interface Shape {
	readonly color?: Color;
	readonly priority: number;
	render(plot: Plot): string;
}

export class Circle implements Shape {
	constructor(
		readonly center: Vec2,
		readonly radius: number,
		readonly color: Color = Color.DEFAULT,
	) {}

	get priority(): number {
		return this.color === Color.DEFAULT ? 1 : 0;
	}

	render(plot: Plot): string {
		const center = plot.applyTransform(this.center);
		const radius = this.radius * plot.scale;
		const classes = getColorClasses(this.color);
		return `<circle	class="stroke-2 ${classes}" fill="none" cx=${center[0]} cy=${center[1]} r=${radius} />`;
	}
}

export class Line implements Shape {
	readonly priority = 10;

	constructor(
		readonly p1: Vec2,
		readonly p2: Vec2,
		readonly type: LineType = LineType.SEGMENT,
		readonly color: Color = Color.DEFAULT,
	) {}

	render(plot: Plot): string {
		let p1 = plot.applyTransform(this.p1);
		let p2 = plot.applyTransform(this.p2);
		if (this.type === LineType.EXTENDED) {
			const center = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
			const maxDist = Math.SQRT2 * plot.imageSize;
			const scale = (2 * maxDist) / distance(p1, p2);
			const diff = [p2[0] - center[0], p2[1] - center[1]];
			p1 = [center[0] - diff[0] * scale, center[1] - diff[1] * scale];
			p2 = [center[0] + diff[0] * scale, center[1] + diff[1] * scale];
		}

		const classes = getColorClasses(this.color);
		return `<line class="stroke-2 ${classes}" x1=${p1[0]} y1=${p1[1]} x2=${p2[0]} y2=${p2[1]} />`;
	}
}

export class Point implements Shape {
	readonly priority = 20;

	constructor(
		readonly coords: Vec2,
		private readonly type: PointType = PointType.PIECE,
		readonly color: Color = Color.DEFAULT,
	) {}

	render(plot: Plot): string {
		const coords = plot.applyTransform(this.coords);
		const radius = this.pointRadius() * plot.scale;
		const classes = getColorClasses(this.color, true);
		return `<circle	class="${classes}" cx=${coords[0]} cy=${coords[1]} r=${radius} />`;
	}

	private pointRadius(): number {
		switch (this.type) {
			case PointType.PIECE:
				return 0.3;
			case PointType.MARKER:
				return 0.1;
		}
	}
}

export function points(...coords: Vec2[]): Shape[] {
	return coords.map((c) => new Point(c));
}

export function coloredPoints(color: Color, ...coords: Vec2[]): Shape[] {
	return coords.map((c) => new Point(c, PointType.PIECE, color));
}

export function findCircle(p1: Vec2, p2: Vec2, p3: Vec2): Circle | Line {
	const den = det3(p1[0], p1[1], 1, p2[0], p2[1], 1, p3[0], p3[1], 1);
	if (Math.abs(den) < 1e-6)
		return new Line(p1, p2, LineType.EXTENDED, Color.RED);
	const ps = p1[0] ** 2 + p1[1] ** 2;
	const qs = p2[0] ** 2 + p2[1] ** 2;
	const rs = p3[0] ** 2 + p3[1] ** 2;
	const xNum = det3(ps, p1[1], 1, qs, p2[1], 1, rs, p3[1], 1);
	const yNum = det3(ps, p1[0], 1, qs, p2[0], 1, rs, p3[0], 1);
	const center: Vec2 = [xNum / (2 * den), -yNum / (2 * den)];
	const radius = distance(center, p1);
	return new Circle(center, radius, Color.RED);
}

export function easyPoints(
	digits: string,
	color: Color = Color.DEFAULT,
): Shape[] {
	const filtered = digits.replaceAll(" ", "");
	if (filtered.length % 2 !== 0)
		throw new Error("The coordinates must be in pairs");

	function getDigit(c: string): number {
		if (c < "0" || c > "9") throw new Error("Invalid coordinates");
		return Number(c);
	}

	const coords: Vec2[] = [];
	for (let i = 0; i < filtered.length; i += 2) {
		const x = getDigit(filtered[i]);
		const y = getDigit(filtered[i + 1]);
		coords.push([x, y]);
	}
	return coords.map((c) => new Point(c, PointType.PIECE, color));
}

/**
 * Automatically generate points based on the given digits.
 * Digits are expected to be in the range of 0 to 9.
 * The circle formed by the first three points and its center will
 * also be added into the list.
 */
export function easyCircle(digits: string): Shape[] {
	const res = easyPoints(digits);
	if (res.length >= 3) {
		const circle = findCircle(
			(res[0] as Point).coords,
			(res[1] as Point).coords,
			(res[2] as Point).coords,
		);
		if (circle instanceof Circle)
			res.push(new Point(circle.center, PointType.MARKER, Color.RED));
		res.push(circle);
	}
	return res;
}

/**
 * Find the circle and all the grid points on the circle, given the
 * circle equation: (kx - a)^2 + (ky - b)^2 = c
 */
export function fromEquation(
	k: number,
	a: number,
	b: number,
	c: number,
	onlyPoints = false,
): Shape[] {
	function check(x: number, y: number): boolean {
		return (k * x - a) ** 2 + (k * y - b) ** 2 - c === 0;
	}

	// Relaxed by 1 to avoid rounding errors
	const xMin = Math.floor((a - Math.sqrt(c)) / k);
	const xMax = Math.ceil((a + Math.sqrt(c)) / k);
	const res: Shape[] = [];
	for (let x = xMin; x <= xMax; x++) {
		const y1 = Math.round((b + Math.sqrt(c - (k * x - a) ** 2)) / k);
		const y2 = Math.round((b - Math.sqrt(c - (k * x - a) ** 2)) / k);
		if (check(x, y1)) res.push(new Point([x, y1]));
		if (check(x, y2)) res.push(new Point([x, y2]));
	}

	const center: Vec2 = [a / k, b / k];
	if (!onlyPoints) {
		res.push(new Circle(center, Math.sqrt(c) / k, Color.RED));
		res.push(new Point(center, PointType.MARKER, Color.RED));
	}
	return res;
}

export function renderShapes(plot: Plot, shapes: Shape[]): string {
	const imageSize = plot.imageSize;
	shapes.sort((a, b) => a.priority - b.priority);
	const renderedShapes = shapes.map((s) => s.render(plot)).join("");
	return `
        <svg
            role="img"
            aria-label="共圆棋盘状态示意图"
            width=${imageSize} height=${imageSize} viewBox="{0 0 ${imageSize} ${imageSize}}"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${plot.renderGrid()}
			${renderedShapes}
        </svg>
    `;
}

function distance(p1: Vec2, p2: Vec2): number {
	return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

function det3(
	m11: number,
	m12: number,
	m13: number,
	m21: number,
	m22: number,
	m23: number,
	m31: number,
	m32: number,
	m33: number,
): number {
	return (
		m11 * (m22 * m33 - m23 * m32) +
		m12 * (m23 * m31 - m21 * m33) +
		m13 * (m21 * m32 - m22 * m31)
	);
}
