declare module "edmonds-blossom" {
  /**
   * Edmonds' weighted maximum matching (blossom algorithm) over a general
   * (non-bipartite) graph. `edges` is a list of [vertexA, vertexB, weight]
   * triples; returns a `mate` array where `mate[v]` is the index `v` is
   * matched to, or -1 if unmatched. With `maxCardinality: true`, the
   * solver maximizes the number of matched vertices first, breaking ties
   * by total weight (rather than maximizing weight alone, which can leave
   * more vertices unmatched).
   */
  export default function blossom(
    edges: Array<[number, number, number]>,
    maxCardinality?: boolean,
  ): number[];
}
