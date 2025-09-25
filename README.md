# discourse-project-uniform
This plugin shows a dynamically updating uniform for the 16AA member showing group membership lanyard, rank, qualifications, and awards.

![Showcase Image](./assets/showcase.png)

## Debug Mode
Debug Mode can be set to 'true' or 'false' via the first line of code in the assets/javascripts/discourse/lib/pu-utils.js file, this will override the Debug Mode setting for the plugin in the discourse admin panel. Debug Mode will add browser dev console output and show tooltip areas outlined with red rectangles.

## To-Do

### Issues:
- [ ] Extra line break/gap between the bottom of the uniform canvas and the "STATS" text.
- 

### Additions:
- [ ] Tooltips for the parachute regiment collar badges.
- [ ] Commanders Course badge.
- [ ] External URL provider?
- [ ] Verify dev console for deprecated stuff
- [ ] RAF Enlisted (FSAcr + SAcr) uniforms + ranks + specific qualifications + awards
- [ ] 7RHA + FST graphics (Qualifications)
- [ ] Add Recruit graphics
- [ ] Should we add more info than just 4 Platoon for the various 4 Platoon elements?
- [ ] Add and organise implementation of remaining qualifications graphics
- [ ] Community Support Arms ?
- [ ] More...

## Features & Components Overview

### 1) Features

* **Uniform on users Summary tab**
  Automatically renders a British-Army/RAF style uniform on a member’s Discourse user Summary page. The uniform shows rank insignia, unit/group crests, lanyards, qualifications badges, and up to 8 medal ribbons (two rows of four).

* **Per-group visuals & lanyards (including Platoon/FSG/Signals/CSMR)**
  Group membership adds crests and appropriate **lanyard** images; each lanyard has a defined tooltip region on the canvas.

* **Per-service variants for some quals**
  Examples: **Paratrooper** badge swaps to a RAF variant when the user’s highest rank is RAF. **1st Class Marksman** does not display for 16CSMR members, flight ranks, or BA ranks of WO2 or above.

* **Rich tooltips (hoverable hot-zones)**
  Hovering over rank patches, qualifications, lanyards, group crests, and ribbons shows image-backed tooltips (with image + text).

* **Fast page loads via image caching**
  Foreground and ribbon images are loaded with an in-memory cache to avoid re-downloads.

### 2) Discourse Admin Options

* **Admin-only toggle** via site setting that blocks non-admins from seeing the plugin feature when enabled.

* **Debug toggle** via site setting that adds extensive debugging console messages and red hitbox area indicators for tooltips.

### 3) Code structure

* **Initializer (entry point):** page-change hook, data fetch, debug overlay, calls the pipeline. `assets/javascripts/discourse/initializers/discourse-project-uniform.js.es6`
* **Data catalog:** backgrounds, ranks, groups, lanyards, quals, awards (+ tooltip metadata & hit-areas). `assets/javascripts/discourse/uniform-data.js`
* **Prepare step:** builds the “what to draw” lists (bg/fg/ribbons/quals), applies throttling and special rules. `lib/pu-prepare.js`
* **Render step:** draws canvas, composes layers, lays out ribbons, registers tooltips. `lib/pu-render.js`
* **Tooltip engine:** registers hit-regions, attaches/fades tooltip DOM, optional debug boxes. `lib/pu-tooltips.js`
* **Styles:** `.canvas-tooltip` CSS. `assets/stylesheets/canvas-tooltip.scss`
* **Assets:** images for uniforms, ranks, groups, lanyards, quals (incl. tooltip variants), ribbons, and medals (folder tree in the code summary).

## Component Inventory

### A) Uniform backgrounds (base canvases)

* **British Army – Officer**
* **British Army – Enlisted**
* **RAF – Officer** 
* **RAF – Enlisted**

### B) Rank catalog (with tooltip hit-areas)

**British Army – Officers**

* Major, Captain, Lieutenant, Second\_Lieutenant (collar regions)

**British Army – Enlisted**

* Warrant\_Officer\_Class\_2, Colour\_Sergeant, Staff\_Sergeant, Sergeant, Corporal, Lance\_Corporal (sleeve regions)

**Royal Air Force – Officers**

* Squadron\_Leader, Flight\_Lieutenant, Flying\_Officer, Pilot\_Officer (sleeve braid regions)

**Royal Air Force – Enlisted (Aircrew)**

* Flight\_Sergeant\_Aircrew, Sergeant\_Aircrew (sleeve regions)

### C) Groups & crests + lanyards

### Group images

* **16CSMR** shows **RAMC** badges on the collars.
* **7RHA** shows **Royal Artillery** badges on the collars.

### Lanyards (image + tooltip)

* **Lightblue & Maroon** (Coy HQ)
* **Red** (1 Platoon)
* **Green** (2 Platoon - not in use as of this writing)
* **Black** (3 Pl; FSG & FSG HQ; 4-1; 13AASR; 16CSMR; 216 Para Signals)
* **Red & Blue** (7RHA)
* **Green & Lightgrey** (MI)

### D) Qualifications (with gating rules)

**Pilot track (only highest shown):**

* **Senior Pilot**
* **Junior Pilot**

**Marksmanship track (only highest shown):**

* **Sniper**
* **Sharpshooter**
* **1st Class Marksman**

**Leadership track (only highest shown):**

* **PCBC** (Platoon Commanders Battle Course)
* **PSBC** (Platoon Sergeants Battle Course)
* **SCBC** (Section Commanders Battle Course)
* **FTCC** (Fire Team Commanders Course)

**Other notable quals:**

* **CMT** (Combat Medical Technician) — only rendered for 16CSMR even if user in other group has the qualification.
* **Paratrooper** with **RAF-specific art variant**. Swaps if flight rank.

### E) Ribbons & Awards (with layout, priority, & tooltips)

* Meritorious Service Medal
* Most Valuable Soldier
* Mention in Dispatches with Four Oak Leaves (5× award)
* Mention in Dispatches with Three Oak Leaves (4× award)
* Mention in Dispatches with Two Oak Leaves (3× award)
* Mention in Dispatches with Oak Leaf (2× award)
* Mention in Dispatches (single award)
* Significant Effort Gold
* Significant Effort
* Long Service and Good Conduct Medal with Two Silver Clasps (10 years)
* Long Service and Good Conduct Medal with Silver Clasp (5 years)
* Long Service and Good Conduct Medal (2 years)
* Mission Maker First Class (3rd Operation)
* Mission Maker Second Class (2nd Operation)
* Mission Maker Third Class (1st series of missions)
* Technical Excellence
* RRO Excellence Award
* Recruiter Medal
* Esprit de Corps with Gold Clasp
* Esprit de Corps
* Citation with Four Oak Leaves (5× award)
* Citation with Three Oak Leaves (4× award)
* Citation with Two Oak Leaves (3× award)
* Citation with Oak Leaf (2× award)
* Citation (single award)