# SwapNight — three-minute walkthrough

Open the [deployed app](https://swapnight.trevorsuna-c38.workers.dev) and follow along. Everything below runs in the browser-local **Explore demo**, so you can try the full exchange lifecycle alone. Maya, Sara, and Lina are clearly labeled fictional adults; their exchanges and handovers are simulated and never touch real events or accounts.

**0:00–0:20 — The idea**

*Bring something you never wear. Find something you will. See it on yourself before you swap.* SwapNight is a private event, not a marketplace.

Click **Explore demo**, then **Reset demo**. Note the fictional-adult labels and the **Demo participant** switcher, which lets one person act as every participant.

**0:20–0:50 — The rack and the try-on preview**

Open Sara’s blouse. The original sample photo, condition, size, and measurements stay visible: AI try-on is an appearance preview, not a fit guarantee, and fit is still checked at handover.

With your own consented adult photo you can use **Generate real try-on**, which sends a real YouCam AI Clothes request. The request runs independently, so you can keep exploring while it processes; finished results are saved under **My previews**. Sign in first; each account can run five live previews per day.

**0:50–1:20 — Why a circle helps**

Close the garment. Maya offers a jacket and wants Sara’s blouse. Sara wants Lina’s cardigan. Lina wants Maya’s jacket. No two people have a reciprocal match.

The visual chain shows these explicit preferences — willingness is never inferred by AI. Click **Find my swap** to see the three-person proposal and the current participant’s **You give / You receive**. If you’re signed in and have tried on the piece you would receive, your genuine YouCam preview appears right above **Accept**; otherwise **See it on me first** opens that garment’s try-on panel.

**1:20–1:55 — Everyone stays in control**

Accept as Maya. Switch to Sara and accept. Switch to Lina and accept. The first acceptance holds the garments atomically; once everyone accepts, the exchange is reserved — which is not the same as the physical swap having happened.

You’ll see **Everyone accepted · reserved** and each person’s acceptance state.

**1:55–2:25 — Handover is a separate step**

For each participant, check condition/measurements, the fitting opportunity, and the actual give/receive, then press **Confirm simulated handover**. The exchange is completed only after all three confirm. In a real event, this checklist represents people physically handing over their items.

**2:25–2:50 — A no is allowed**

Click **Reset demo** and find the exchange again. Accept as Maya, switch to Sara, and decline: the cancellation reason appears and matching becomes available again. Find another proposal and click **Cancel exchange & release items** — all reservations release together.

**2:50–3:00 — The result**

Three people. Three pieces. Everyone gets something they explicitly wanted. Less in the landfill; more in the group chat.

## Under the hood

Postgres revision-checked commits, private Supabase storage with short-lived signed URLs, resumable YouCam provider tasks, and separate per-browser demo state. Tests cover conflicts, access control, expiry, duplicate commands, and mobile flows — see the README’s Verification section.
