import { describe, expect, it } from "vitest";
import { scoreMatch, generateRecommendations, Bounty, ContributorProfile } from "./recommendations";

const makeBounty = (labels: string[], status: "open" | "reserved" | "submitted" | "released" | "refunded" | "expired" = "open"): Bounty => ({
  id: "test-1",
  repo: "owner/repo",
  issueNumber: 1,
  title: "Test bounty",
  summary: "A test bounty",
  maintainer: "maintainer",
  tokenSymbol: "XLM",
  amount: 100,
  labels,
  status,
  createdAt: Date.now(),
  deadlineAt: Date.now() + 86400000,
  version: 1,
  events: [],
});

describe("scoreMatch", () => {
  it("returns 1 when all skills match all labels (full overlap)", () => {
    const bounty = makeBounty(["rust", "smart-contract", "stellar"]);
    const skills = ["rust", "smart-contract", "stellar"];
    expect(scoreMatch(bounty, skills)).toBe(1);
  });

  it("returns 0 when no skills match any labels", () => {
    const bounty = makeBounty(["javascript", "react"]);
    const skills = ["rust", "go"];
    expect(scoreMatch(bounty, skills)).toBe(0);
  });

  it("returns correct fraction for partial match", () => {
    const bounty = makeBounty(["javascript", "react", "frontend"]);
    const skills = ["javascript", "rust", "go"];
    // 1 out of 3 skills match → 1/3
    expect(scoreMatch(bounty, skills)).toBeCloseTo(1 / 3);
  });

  it("returns 0 when skills array is empty", () => {
    const bounty = makeBounty(["javascript"]);
    expect(scoreMatch(bounty, [])).toBe(0);
  });

  it("returns 0 when bounty has no labels", () => {
    const bounty = makeBounty([]);
    const skills = ["javascript", "react"];
    expect(scoreMatch(bounty, skills)).toBe(0);
  });

  it("returns 0 when both skills and labels are empty", () => {
    const bounty = makeBounty([]);
    expect(scoreMatch(bounty, [])).toBe(0);
  });

  it("is case-insensitive", () => {
    const bounty = makeBounty(["Rust", "Smart-Contract"]);
    const skills = ["rust", "SMART-CONTRACT"];
    expect(scoreMatch(bounty, skills)).toBe(1);
  });

  it("handles skills that are a superset of labels", () => {
    const bounty = makeBounty(["rust"]);
    const skills = ["rust", "go", "python"];
    // 1 out of 3 skills match → 1/3
    expect(scoreMatch(bounty, skills)).toBeCloseTo(1 / 3);
  });

  it("handles duplicate skills in the input array", () => {
    const bounty = makeBounty(["rust", "go"]);
    const skills = ["rust", "rust", "go"];
    // All 3 skill entries match something in labels → 3/3 = 1
    expect(scoreMatch(bounty, skills)).toBe(1);
  });
});

describe("generateRecommendations with skill-match tiebreaker", () => {
  it("uses scoreMatch as tiebreaker when scores are equal", () => {
    // Both bounties have identical labels from the recommendation engine's perspective
    // but one matches the contributor's skills better
    const bountyA = makeBounty(["rust", "cli"]);
    const bountyB = makeBounty(["go", "cli"]);
    const profile: ContributorProfile = {
      completedLabels: [],
      preferredRepos: [],
      skills: ["rust"],
      averageRewardRange: { min: 0, max: 1000 },
    };

    const recommendations = generateRecommendations([bountyA, bountyB], profile, 5);
    // bountyA has "rust" which matches, so it should be first
    expect(recommendations.length).toBe(2);
    expect(recommendations[0].bounty.id).toBe(bountyA.id);
    expect(recommendations[1].bounty.id).toBe(bountyB.id);
  });

  it("still sorts by primary score when scores differ", () => {
    // bountyB has labels matching more completed labels → higher score
    const bountyA = makeBounty(["rust"]);
    const bountyB = makeBounty(["rust", "react"]);
    const profile: ContributorProfile = {
      completedLabels: ["react"],  // bountyB gets bonus for this
      preferredRepos: [],
      skills: ["rust"],
      averageRewardRange: { min: 0, max: 1000 },
    };

    const recommendations = generateRecommendations([bountyA, bountyB], profile, 5);
    // bountyB should be first due to higher primary score (react completedLabel bonus)
    expect(recommendations[0].bounty.id).toBe(bountyB.id);
  });
});
