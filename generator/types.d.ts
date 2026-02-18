import * as three from "three";


export type BreadboardConfig = {
    /** center-to-center distance between holes
     * @default 2.54 */
    hole_spacing: number;
    /** width of the hole
     * @default 1 */
    hole_inner_width: number;
    /** width of the top of the hole's chamfer
     * @default 2 */
    hole_outer_width: number;
    /** total hole depth
     * @default 7 */
    hole_inner_depth: number;
    /** depth of the hole's chamfer
     * @default 0.5 */
    hole_outer_depth: number;
    /** number of subsections on the breadboard
     * @default 2 */
    num_subsections: number;
    /** distance (in holes) between subsections
     * @default 2 */
    subsection_spacing: number;
    /** number of sections on the breadboard
     * @default 5 */
    num_sections: number;
    /** number of rows per section
     * @default 6 */
    rows_per_section: number;
    /** number of holes per row
     * @default 5 */
    holes_per_row: number;
    /** power rails properties */
    power_rails: PowerRailConfig;
    /** thickness of the breadboard. must be larger than hole_inner_depth
     * @default 9 */
    board_thickness: number;
    /** settings for labels */
    labels: LabelConfig;
    /** repeat the whole breadboard x times horizontally
     * @default 1 */
    num_breadboards_x: number;
    /** repeat the whole breadboard y times vertically
     * @default 1 */
    num_breadboards_y: number;
    /** horizontal number of holes between breadboards
     * @default 2 */
    breadboard_x_gap: number;
    /** vertical number of holes between breadboards
     * @default 2.5 */
    breadboard_y_gap: number;
};

type PowerRailConfig = {
    /** whether the breadboard has power rails or not 
     * @default true */
    enabled: boolean;
    /** number of rails on each side of the breadboard
     * @default 2 */
    num_cols: number;
    /** number of holes per section
     * @default 5 */
    holes_per_section: number;
    /** distance (in holes) between the power rail and the main holes
     * @default 2 */
    main_spacing: number;
};

type LabelConfig = {
    /** whether labels are enabled or not
     * @default true */
    enabled: boolean;
    /** label of the first row
     * @default 0 */
    start: number;
    /** label step count
     * @default 5 */
    increment: number;
};

export class Breadboard {
    config: BreadboardConfig;
    #group: three.Group;
    constructor(config: BreadboardConfig);
}
