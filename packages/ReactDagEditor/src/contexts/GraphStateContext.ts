import * as React from "react";
import { emptyDummyNodes, IDummyNodes } from "../components/dummyNodes";
import { emptySelectBoxPosition, ISelectBoxPosition } from "../components/Graph/SelectBox";
import { ILine } from "../components/Line";
import { GraphFeatures } from "../Features";
import { IContainerRect, IEvent } from "../Graph.interface";
import { GraphModel } from "../models/GraphModel";
import { Debug } from "../utils/debug";
import { IPoint } from "../utils/geometric";
import { IHistory, resetUndoStack } from "../utils/history";
import { IGraphConfig } from "./GraphConfigContext";

export enum GraphBehavior {
  default = "default",
  dragging = "dragging",
  panning = "panning",
  multiSelect = "multiSelect",
  connecting = "connecting",
  addingNode = "addingNode"
}

export const EMPTY_TRANSFORM_MATRIX: ITransformMatrix = [1, 0, 0, 1, 0, 0];

/**
 * @deprecated
 */
export const EMPTY_ZOOM_PAN: Pick<IViewPort, "transformMatrix"> = {
  transformMatrix: EMPTY_TRANSFORM_MATRIX
};

export const EMPTY_VIEW_PORT: IViewPort = {
  rect: undefined,
  transformMatrix: EMPTY_TRANSFORM_MATRIX
};

export const EMPTY_GRAPH_STATE: IGraphState = {
  behavior: GraphBehavior.default,
  data: resetUndoStack(GraphModel.empty()),
  viewPort: {
    transformMatrix: [1, 0, 0, 1, 0, 0],
    rect: undefined
  },
  dummyNodes: emptyDummyNodes(),
  alignmentLines: [],
  activeKeys: new Set<string>(),
  selectBoxPosition: emptySelectBoxPosition(),
  connectState: undefined
};

/**
 *
 */
function warnGraphStateContext(): void {
  Debug.warn("Missing GraphStateContext, GraphStateContext must be used as child of GraphStateStore");
}

export const defaultGraphStateContext: IGraphStateContext = {
  get state(): IGraphState {
    warnGraphStateContext();
    return EMPTY_GRAPH_STATE;
  },
  dispatch: () => {
    warnGraphStateContext();
  }
};

export type TDataComposer<NodeData = unknown, EdgeData = unknown, PortData = unknown> = (
  prev: GraphModel<NodeData, EdgeData, PortData>,
  prevState: IGraphState<NodeData, EdgeData, PortData>
) => GraphModel<NodeData, EdgeData, PortData>;

export interface IGraphDataState<NodeData = unknown, EdgeData = unknown, PortData = unknown>
  extends IHistory<GraphModel<NodeData, EdgeData, PortData>> {}

export type ITransformMatrix = [number, number, number, number, number, number];

export interface IViewPort {
  rect?: IContainerRect;
  visibleRect?: IContainerRect;
  transformMatrix: ITransformMatrix;
}

export interface IConnectingState {
  sourceNode: string;
  sourcePort: string;
  targetNode: string | undefined;
  targetPort: string | undefined;
  movingPoint: IPoint | undefined;
}

export const EMPTY_CONNECT_STATE = {
  sourceNode: undefined,
  sourcePort: undefined,
  targetNode: undefined,
  targetPort: undefined,
  movingPoint: {
    x: 0,
    y: 0
  }
};

export interface IGraphState<NodeData = unknown, EdgeData = unknown, PortData = unknown> {
  data: IGraphDataState<NodeData, EdgeData, PortData>;
  viewPort: IViewPort;
  behavior: GraphBehavior;
  dummyNodes: IDummyNodes;
  alignmentLines: ILine[];
  activeKeys: Set<string>;
  contextMenuPosition?: IPoint;
  selectBoxPosition: ISelectBoxPosition;
  connectState: IConnectingState | undefined;
}

export type IGraphAction<NodeData = unknown, EdgeData = unknown, PortData = unknown> = IEvent<
  NodeData,
  EdgeData,
  PortData
>;

export type IDispatchCallback<NodeData = unknown, EdgeData = unknown, PortData = unknown> = (
  state: IGraphState<NodeData, EdgeData, PortData>,
  prevState: IGraphState<NodeData, EdgeData, PortData>
) => void;

export type IDispatch<NodeData = unknown, EdgeData = unknown, PortData = unknown, Action = never> = (
  action: IEvent<NodeData, EdgeData, PortData> | Action,
  callback?: IDispatchCallback<NodeData, EdgeData, PortData>
) => void;

/**
 * @deprecated
 */
export type TDispatch<NodeData = unknown, EdgeData = unknown, PortData = unknown, Action = never> = IDispatch;

export interface IGraphStateContext<NodeData = unknown, EdgeData = unknown, PortData = unknown, Action = never> {
  state: IGraphState<NodeData, EdgeData, PortData>;
  dispatch: IDispatch<NodeData, EdgeData, PortData, Action>;
}

/**
 * use separate context for now to improve performance
 * until https://github.com/reactjs/rfcs/pull/119 or something equivalent
 */
export const GraphValueContext = React.createContext<GraphModel>(
  new Proxy(GraphModel.empty(), {
    get: (target, prop) => {
      // eslint-disable-next-line no-console
      console.warn("Default graph data value is being used. Please check if you forget rendering Graph component");

      return target[prop];
    }
  })
);

export const GraphStateContext = React.createContext<IGraphStateContext>(defaultGraphStateContext);

export interface IGraphReducerContext {
  graphConfig: IGraphConfig;
  features: Set<GraphFeatures>;
}

export type IGraphReactReducer<
  NodeData = unknown,
  EdgeData = unknown,
  PortData = unknown,
  Action = never
> = React.Reducer<IGraphState<NodeData, EdgeData, PortData>, IEvent<NodeData, EdgeData, PortData> | Action>;

export type IGraphReducer<NodeData = unknown, EdgeData = unknown, PortData = unknown, Action = never> = (
  next: IGraphReactReducer<NodeData, EdgeData, PortData, Action>,
  context: IGraphReducerContext
) => IGraphReactReducer<NodeData, EdgeData, PortData, Action>;

export const setData = <NodeData = unknown, EdgeData = unknown, PortData = unknown>(
  state: IGraphState<NodeData, EdgeData, PortData>,
  data: GraphModel<NodeData, EdgeData, PortData>
): IGraphState<NodeData, EdgeData, PortData> => ({
  ...state,
  data: {
    ...state.data,
    present: data
  }
});

export const updateData = <NodeData = unknown, EdgeData = unknown, PortData = unknown>(
  state: IGraphState<NodeData, EdgeData, PortData>,
  f: (data: GraphModel<NodeData, EdgeData, PortData>) => GraphModel<NodeData, EdgeData, PortData>
): IGraphState<NodeData, EdgeData, PortData> => ({
  ...state,
  data: {
    ...state.data,
    present: f(state.data.present)
  }
});
