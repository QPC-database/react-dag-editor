import { act, render } from "@testing-library/react";
import * as React from "react";
import {
  dataReadonlyMode,
  GraphEdgeState,
  GraphModel,
  GraphNodeState,
  GraphPortState,
  IPropsAPI,
  notSelected
} from "../../src";
import { TestComponent } from "../TestComponent";
import { makeEdge, makeEdges, makeNode, makeNodes, makePorts } from "../utils";

const ports = makePorts([GraphPortState.default, GraphPortState.default, GraphPortState.default]);

const deleteSelectedItems = (data: GraphModel) => {
  return data.deleteItems({
    node: notSelected,
    edge: notSelected
  });
};

it("should do nothing if delete disabled", () => {
  const data = GraphModel.fromJSON({
    edges: makeEdges([
      [GraphEdgeState.connectedToSelected, ["0", "0"], ["1", "1"]],
      [GraphEdgeState.unconnectedToSelected, ["0", "1"], ["2", "0"]]
    ]),
    nodes: makeNodes(
      [GraphNodeState.connectedToSelected, GraphNodeState.selected, GraphNodeState.unconnectedToSelected],
      ports
    )
  });

  const propsAPIRef = React.createRef<IPropsAPI>();
  render(<TestComponent propsAPIRef={propsAPIRef} data={data} features={dataReadonlyMode} />);

  act(() => {
    propsAPIRef.current?.delete();
  });

  expect(propsAPIRef.current?.getData().toJSON()).toEqual({
    edges: makeEdges([
      [GraphEdgeState.connectedToSelected, ["0", "0"], ["1", "1"]],
      [GraphEdgeState.unconnectedToSelected, ["0", "1"], ["2", "0"]]
    ]),
    nodes: makeNodes(
      [GraphNodeState.connectedToSelected, GraphNodeState.selected, GraphNodeState.unconnectedToSelected],
      ports
    )
  });
});

it("should do nothing if nothing selected", () => {
  const data = GraphModel.fromJSON({
    edges: makeEdges([
      [GraphEdgeState.default, ["0", "0"], ["1", "1"]],
      [GraphEdgeState.default, ["0", "1"], ["2", "0"]]
    ]),
    nodes: makeNodes([GraphNodeState.default, GraphNodeState.editing, GraphNodeState.default], ports)
  });

  expect(deleteSelectedItems(data).toJSON()).toEqual(
    GraphModel.fromJSON({
      edges: makeEdges([
        [GraphEdgeState.default, ["0", "0"], ["1", "1"]],
        [GraphEdgeState.default, ["0", "1"], ["2", "0"]]
      ]),
      nodes: makeNodes([GraphNodeState.default, GraphNodeState.editing, GraphNodeState.default], ports)
    }).toJSON()
  );
});

it("should delete related edges", () => {
  const data = GraphModel.fromJSON({
    edges: makeEdges([
      [GraphEdgeState.connectedToSelected, ["0", "0"], ["1", "1"]],
      [GraphEdgeState.unconnectedToSelected, ["0", "1"], ["2", "0"]]
    ]),
    nodes: makeNodes(
      [GraphNodeState.connectedToSelected, GraphNodeState.selected, GraphNodeState.unconnectedToSelected],
      ports
    )
  });

  expect(deleteSelectedItems(data).toJSON()).toEqual(
    GraphModel.fromJSON({
      edges: [makeEdge("1", GraphEdgeState.default, ["0", "1"], ["2", "0"])],
      nodes: [makeNode("0", GraphNodeState.default, ports), makeNode("2", GraphNodeState.default, ports)]
    }).toJSON()
  );
});

it("should only delete node", () => {
  const data = GraphModel.fromJSON({
    edges: [],
    nodes: makeNodes(
      [GraphNodeState.unconnectedToSelected, GraphNodeState.selected, GraphNodeState.unconnectedToSelected],
      ports
    )
  });

  expect(deleteSelectedItems(data).toJSON()).toEqual({
    edges: [],
    nodes: [makeNode("0", GraphNodeState.default, ports), makeNode("2", GraphNodeState.default, ports)]
  });
});

it("should only delete edge", () => {
  const data = GraphModel.fromJSON({
    edges: makeEdges([
      [GraphEdgeState.selected, ["0", "0"], ["1", "1"]],
      [GraphEdgeState.default, ["0", "1"], ["2", "0"]]
    ]),
    nodes: makeNodes([GraphNodeState.default, GraphNodeState.default, GraphNodeState.default], ports)
  });
  expect(deleteSelectedItems(data).toJSON()).toEqual(
    GraphModel.fromJSON({
      edges: [makeEdge("1", GraphEdgeState.default, ["0", "1"], ["2", "0"])],
      nodes: makeNodes([GraphNodeState.default, GraphNodeState.default, GraphNodeState.default], ports)
    }).toJSON()
  );
});