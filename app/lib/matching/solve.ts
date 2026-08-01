import blossom from "edmonds-blossom";
import { evaluateGroup, pairKey, type GroupEvaluation } from "./compatibility";
import type { Candidate } from "./types";

export interface ProposedGroup {
  signupIds: number[];
  score: number;
  explanation: string;
}

export interface MatchingResult {
  groups: ProposedGroup[];
  /** Signups the solver couldn't place -- either no one is feasible with
   * them at all, or they were the odd one out and no existing pair could
   * feasibly absorb them as a third. Needs a human to look at these. */
  unmatchedSignupIds: number[];
}

/**
 * Proposes weekly meditation pairings (occasionally trios) for a set of
 * candidates. Two-phase approach:
 *
 * 1. Maximum-weight matching (blossom algorithm) over every feasible pair,
 *    with maxCardinality so the solver prioritizes matching as many people
 *    as possible over squeezing out a slightly higher total score.
 * 2. If that leaves exactly one (or a few) people unpaired -- unavoidable
 *    whenever the candidate count is odd -- try folding each leftover
 *    person into whichever existing pair would make the best feasible
 *    trio, rather than leaving them out.
 *
 * `previouslyMatchedPairKeys` must be keyed by personId (see
 * lib/matching/compatibility.ts's evaluateGroup for why), not signupId.
 */
export function generateMatches(
  candidates: Candidate[],
  previouslyMatchedPairKeys: ReadonlySet<string>,
): MatchingResult {
  if (candidates.length < 2) {
    return { groups: [], unmatchedSignupIds: candidates.map((c) => c.signupId) };
  }

  const indexBySignupId = new Map(candidates.map((c, i) => [c.signupId, i]));
  const pairEvalCache = new Map<string, GroupEvaluation>();

  function evaluatePairCached(a: Candidate, b: Candidate): GroupEvaluation {
    const key = pairKey(a.signupId, b.signupId);
    let result = pairEvalCache.get(key);
    if (!result) {
      result = evaluateGroup([a, b], previouslyMatchedPairKeys);
      pairEvalCache.set(key, result);
    }
    return result;
  }

  const edges: Array<[number, number, number]> = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const evaluation = evaluatePairCached(candidates[i], candidates[j]);
      if (evaluation.feasible) {
        edges.push([i, j, evaluation.score]);
      }
    }
  }

  const mate = blossom(edges, true);

  const pairedIndices = new Set<number>();
  const groups: ProposedGroup[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const m = mate[i];
    if (m !== undefined && m !== -1 && m > i) {
      pairedIndices.add(i);
      pairedIndices.add(m);
      const evaluation = evaluatePairCached(candidates[i], candidates[m]);
      groups.push({
        signupIds: [candidates[i].signupId, candidates[m].signupId],
        score: evaluation.score,
        explanation: evaluation.explanation,
      });
    }
  }

  let leftoverIndices = candidates.map((_, i) => i).filter((i) => !pairedIndices.has(i));

  for (const leftoverIndex of [...leftoverIndices]) {
    const leftover = candidates[leftoverIndex];
    let bestGroupIndex = -1;
    let bestEvaluation: GroupEvaluation | null = null;

    for (let g = 0; g < groups.length; g++) {
      if (groups[g].signupIds.length !== 2) continue; // don't stack a 2nd extra onto an existing trio
      const members = groups[g].signupIds.map((id) => candidates[indexBySignupId.get(id)!]);
      const evaluation = evaluateGroup([...members, leftover], previouslyMatchedPairKeys);
      if (evaluation.feasible && (!bestEvaluation || evaluation.score > bestEvaluation.score)) {
        bestEvaluation = evaluation;
        bestGroupIndex = g;
      }
    }

    if (bestGroupIndex >= 0 && bestEvaluation) {
      groups[bestGroupIndex] = {
        signupIds: [...groups[bestGroupIndex].signupIds, leftover.signupId],
        score: bestEvaluation.score,
        explanation: bestEvaluation.explanation,
      };
      leftoverIndices = leftoverIndices.filter((i) => i !== leftoverIndex);
    }
  }

  return {
    groups,
    unmatchedSignupIds: leftoverIndices.map((i) => candidates[i].signupId),
  };
}
