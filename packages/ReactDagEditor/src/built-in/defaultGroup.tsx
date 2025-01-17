import * as React from "react";
import { IGroupConfig, IGroupDrawArgs } from "../contexts/GraphConfigContext";

const Renderer: React.FC<IGroupDrawArgs> = props => (
  <rect height={props.height} width={props.width} fill={props.group.fill} />
);
export const defaultGroup: IGroupConfig = {
  render: Renderer
};
