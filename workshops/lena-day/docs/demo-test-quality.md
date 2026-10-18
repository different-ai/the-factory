# Test quality: "A day with Lena" v3 (GPT-6.1 Sol and Qwen3.8 27B)

Runs took place on 17 Oct 2026 on the Mac Studio.

- **Sol:** `feat/workshop-demo-film` (PR #6131), final run at `030f10b147`.
- **Qwen:** `feat/workshop-demo-qwen` (PR #6132).
- **Product fixes:** PR #6130, against `dev`.

## Bottom line

| | GPT-6.1 Sol (Fast) | Qwen3.8 27B |
|---|---|---|
| Final run, live checks | **16 / 17** | 11 / 17 |
| After fixing one check bug (D15, below) | **17 / 17** | **10 / 17** |
| Previous best (v2 report) | 16 / 17 (Automation could not be created) | 8 / 17 |
| Estimated request cost, final run | ≈ $19.67 (146 requests) | ≈ $1.5 |

**The core gap is fixed.** In the morning brief, Lena types one sentence, reviews OpenWork's Automation proposal, clicks **Create Automation**, then **Run now**. A real local Automation runner executes it with the same model and saves the brief to her drafts. That works for both models now; in v2 it could not be created at all.

## What was broken, and the fixes

| # | Problem found | Fix | Where |
|---|---|---|---|
| 1 | **Create Automation was disabled.** A proposal without a model fell back to the Desktop-only free model, which Cloud placement never offers. | Use the first model the member can run. Test added. | Product, #6130 |
| 2 | **Create Automation failed with "Failed to fetch" in the web app.** Den's CORS rules didn't allow the `x-openwork-automation-model-attention` header the app sends, so the browser blocked the request and it never reached Den. | Allow the header. | Product, #6130 |
| 3 | **Run now did nothing.** The agent read "Every Monday through Friday at 09:00" in its instructions and skipped the Saturday-evening manual run as off-schedule. | The headless runner's system note says the run should happen now. | Product, #6130 |
| 4 | **Saved skills were just steps,** so reusing one meant redoing the research and rewriting the slide script. | The built-in create-skill guidance now asks for inputs, exact sources, the shortest steps, the reusable script, and the output contract. | Product, #6130 |
| 5 | The eval model wasn't available to Automations, and no runner existed locally. | Register it as an org model, and start `ee/apps/headless-runner` in the world. | Harness, #6131 |
| 6 | The runner speaks Chat Completions, but GPT-6.1 Sol rejects `max_tokens` and won't take function tools there (needs `/responses`; `reasoning_effort: none` is also refused). | The proxy acts like a gateway for the runner: it translates Chat Completions ↔ Responses for the same pinned model. Test added. | Harness, #6131 |
| 7 | **Large PowerPoint uploads failed** ("Tool execution aborted"), and Qwen timed out, because the whole file went through a tool call as base64. | Graph-style OneDrive **upload sessions**: build the file locally, then `curl` it to a one-time URL. | Harness and fixture, #6131 / #6132 |
| 8 | Qwen's late steps died when the proxy's 35-minute lifetime ran out. | Longer day budgets; Qwen gets a proportionate 10-minute turn clock. | #6132 |
| 9 | Test robustness. | Wait for the app before the first New session. Open the Automation's detail before Run now. Always return to a chat after leaving it. | #6131 |

## Results by step (final runs)

| Step | Sol | Qwen |
|---|---|---|
| D0 Set up the morning-brief Automation (Create Automation) | PASS | PASS |
| D1 Run now → brief draft (real runner) | PASS | PASS |
| D2 Question about the brief | PASS | PASS |
| D3 To do / In progress / Done folders | PASS | PASS |
| D4 Blue Harbor one-slide PPTX + reply | PASS | FAIL (slide yes, no threaded reply) |
| D5 Save as a skill | PASS | FAIL (never called create_skill) |
| D6 Reuse the skill from the `/` menu for Northwind | PASS | FAIL (no skill) |
| D7 Share the skill with Nora | PASS | FAIL (no skill) |
| D8 Account review deck | PASS | PASS |
| D9 Jira task for Nora | PASS | PASS |
| D10 IT ticket, Windows login | PASS | FAIL (wrong Application value) |
| D11 Dog policy: honest + who to ask | PASS | FAIL |
| D12 Book, then move, a meeting | PASS | PASS |
| D13 Threads to Done | PASS | PASS |
| D14 Live App from the forecast | PASS | PASS |
| D15 Nora's Activity: Lena's skill + new connector | PASS* | FAIL* |
| D16 Feedback form (opened only) | PASS | PASS |

\* **D15 check bug.** The run's live check looked up the plugin's display name, the lookup returned nothing, and Sol was marked failed.

- **Sol:** the recorded Activity text contains "customer-product-comparison was shared with you" (Skill, Try it) and "Fictional morning news is ready to use". The corrected check now matches the skill's own name, and it passes on that recorded text.
- **Qwen:** its run used the older, looser check, which passed because other organization plugins also appear as "… was shared with you". Qwen never saved a skill, so under the corrected check it fails.

## Skill reuse: clearer, not faster

- **Timing:** Sol's first comparison took 71 s; the skill-based Northwind run took 84 s. Earlier runs were 107→143 s, 110→137 s and 116→121 s.
- **Why the skill is clear:** it now carries the script (`customer_comparison_slide.py`) and the source pages, and Lena starts it from the **/** menu, so the chip appears on her message.
- **Why it isn't faster:** the second customer still needs its own emails and account context, so each run does real reading. The video says "she just picks her skill and says what's different", not "faster".

## Honest limits

- **Services:** Outlook, OneDrive, Confluence, Jira and news are in-memory stand-ins seeded with fictional data, not real tenants. OAuth and real delivery are not tested.
- **The Automation run is real, but local:** the local headless runner reaches the stand-ins through Den's MCP. **Run now** was clicked instead of waiting for Monday 09:00.
- **Automations page lags:** it still showed the run as "running" a few seconds after it finished. The video shows the run starting, then the resulting draft.
- **Clarifying questions:** when OpenWork asked one (D5, D9), the test answered "Yes, please go ahead." This is recorded per step.
- **Slides:** rendered from the actual PPTX files with LibreOffice, not PowerPoint.
- **Reliability:** one final run per model is not a reliability claim.
- **What failed along the way:** several runs failed because of harness and environment issues, not model behaviour. These included parallel runs overloading the machine, the app not ready at the first turn, the run page not opened, and proxy rejections. Each was fixed before the final runs.

## Evidence

All paths below are under `evals/results/workshop-narrative/` in each worktree.

- **Per-step results:** `day-<sha>/<profile>/day-matrix.json`, with prompts, reasons, timings and clarifying questions.
- **Recordings:** frame-by-frame screen captures of every surface, plus scene markers.
- **Decks:** the generated PPTX files under `private-artifacts/`, rendered with LibreOffice for the video.
