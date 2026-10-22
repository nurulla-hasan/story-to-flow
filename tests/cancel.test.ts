import { describe, expect, it } from "vitest";
import { cancelJob } from "../src/lib/pipeline";
import { getRepo, DEFAULT_PROJECT_ID } from "../src/lib/db";

describe("cancelJob", () => {
  it("cancels a running job and marks its status as cancelled", () => {
    const repo = getRepo();
    const job = repo.createJob(DEFAULT_PROJECT_ID, "plan");
    expect(job.status).toBe("running");

    const cancelled = cancelJob(job.id);
    expect(cancelled).not.toBeNull();
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.message).toContain("cancelled");

    const fetched = repo.getJob(job.id);
    expect(fetched?.status).toBe("cancelled");
  });

  it("returns the job unchanged if already completed", () => {
    const repo = getRepo();
    const job = repo.createJob(DEFAULT_PROJECT_ID, "plan");
    repo.updateJob(job.id, { status: "done", message: "Finished" });

    const result = cancelJob(job.id);
    expect(result?.status).toBe("done");
  });
});
