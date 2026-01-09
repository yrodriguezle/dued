export const formStatuses = Object.freeze({
  INSERT: "INSERT",
  UPDATE: "UPDATE",
});

export const enum DatagridStatus {
  Added = 0,
  Unchanged = 1,
  Modified = 3,
  Invalid = 4,
  Valid = 5,
  Editing = 6,
}

export const datagridAuxiliaryColumns = Object.freeze(["status"]);

export const directionalHint = {
  topLeftEdge: 0,
  topCenter: 1,
  topRightEdge: 2,
  topAutoEdge: 3,
  bottomLeftEdge: 4,
  bottomCenter: 5,
  bottomRightEdge: 6,
  bottomAutoEdge: 7,
  leftTopEdge: 8,
  leftCenter: 9,
  leftBottomEdge: 10,
  rightTopEdge: 11,
  rightCenter: 12,
  rightBottomEdge: 13,
};

export type DirectionalHint = (typeof directionalHint)[keyof typeof directionalHint];
