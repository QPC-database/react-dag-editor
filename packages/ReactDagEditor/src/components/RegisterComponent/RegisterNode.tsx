import * as React from "react";
import { GraphConfigContext, IRectConfig } from "../../contexts";
import { ICanvasNode } from "../../Graph.interface";

export interface IRegisterNodeProps {
  /**
   * Name of the custom node. The "shape" in your node model should have been registered as the name here.
   */
  name: string;
  /**
   * The config could be a class that implements IRectConfig<ICanvasNode>
   */
  config: IRectConfig<ICanvasNode>;
}

/**
 * Register custom node. Specify the "shape" in your node model(ref interface ICanvasNode) to use your custom node.
 * If not register, will use the default node config.
 *
 * @param props
 */
export const RegisterNode: React.FunctionComponent<IRegisterNodeProps> = props => {
  const graphConfig = React.useContext(GraphConfigContext);

  graphConfig.registerNode(props.name, props.config);

  return null;
};
