// pu-tooltips.js

// Import debug mode toggle and logging utility
import { isDebugEnabled, debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

// Stores tooltip hit regions
const tooltipRegions = [];

// Clears all registered tooltip regions
export function clearTooltips() {
    tooltipRegions.length = 0;
    debugLog("[tooltips] cleared");
}

// Registers a tooltip area with coordinates, size, and content
export function registerTooltip(x, y, width, height, content) {
    debugLog("[tooltips] register:", { x, y, width, height, hasImg: /<img/i.test(content), len: content?.length });
    tooltipRegions.push({ x, y, width, height, content });
}

// Sets up tooltip display on a given canvas
export function setupTooltips(canvas) {
    canvas.classList.add("pu-uniform-canvas");
    const cssMax = canvas.width; // e.g., 695
    canvas.parentElement?.style.setProperty("--uniform-max-w", `${cssMax}px`);
    debugLog("[tooltips] setup start");

    // Prepare parent element for positioning tooltips
    const parent = canvas.parentElement;
    parent.style.position = "relative";
    parent.querySelector(".canvas-tooltip")?.remove(); // remove any old tooltip

    // Draw debug rectangles if debug is enabled (code flag OR admin flag)
    const ctx = canvas.getContext("2d");
    if (isDebugEnabled()) {
        tooltipRegions.forEach((r) => {
            ctx.strokeStyle = "red"; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.width, r.height);
        });
        debugLog("[tooltips] debug-rects drawn:", tooltipRegions.length);
    }

    // Abort controller to clean up event listeners
    const controller = new AbortController();
    const { signal } = controller;

    // Create tooltip element
    const tip = document.createElement("div");
    tip.className = "canvas-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("aria-hidden", "true");
    parent.appendChild(tip);

    // Variables to store element positions and active tooltip content
    let canvasRect = null, parentRect = null, active = null;
    let scaleX = 1, scaleY = 1; // intrinsic -> display scale factors

    // Recalculate bounding rectangles + scales
    const recompute = () => {
        canvasRect = canvas.getBoundingClientRect();
        parentRect = parent.getBoundingClientRect();

        // Intrinsic canvas size (logical pixels)
        const iw = canvas.width || 1;
        const ih = canvas.height || 1;

        // Displayed size (CSS pixels)
        const dw = Math.max(1, canvasRect.width);
        const dh = Math.max(1, canvasRect.height);

        // Scale from intrinsic -> display (used for positioning)
        scaleX = iw / dw;
        scaleY = ih / dh;

        debugLog("[tooltips] recompute rects", { canvasRect, parentRect, scaleX, scaleY, iw, ih, dw, dh });
    };
    recompute();
    window.addEventListener("scroll", recompute, { passive: true, signal });
    window.addEventListener("resize", recompute, { signal });

    // Mouse move handler to detect tooltip region hits
    const onMove = (e) => {
        if (!canvasRect || !parentRect) return;

        // Mouse position relative to canvas in DISPLAY space
        const dx = e.clientX - canvasRect.left;
        const dy = e.clientY - canvasRect.top;

        // Convert to INTRINSIC space for hit testing
        const lx = dx * scaleX;
        const ly = dy * scaleY;

        // Find the tooltip region under the cursor (intrinsic coords)
        const hit = tooltipRegions.find(r => lx >= r.x && lx <= r.x + r.width && ly >= r.y && ly <= r.y + r.height);

        // If no hit, hide tooltip
        if (!hit) {
            if (active) { debugLog("[tooltips] leave region"); }
            active = null;
            tip.classList.remove("visible");
            tip.setAttribute("aria-hidden", "true");
            return;
        }

        // If entering a new tooltip region, update tooltip content
        if (active !== hit.content) {
            active = hit.content;
            tip.innerHTML = hit.content;
            tip.classList.toggle("has-img", hit.content.includes("<img"));
            // reset position before measuring
            tip.style.left = "0px";
            tip.style.top = "0px";
            debugLog("[tooltips] enter region");
        }

        // --- POSITIONING: below + centered, clamp to canvas, flip if needed ---
        const offX = canvasRect.left - parentRect.left;
        const offY = canvasRect.top - parentRect.top;
        const gap = 8; // space between hitbox and tooltip

        // Ensure measurable size (in case hidden)
        let restoreVisibility = false;
        if (!tip.offsetWidth || !tip.offsetHeight) {
            tip.style.visibility = "hidden";
            tip.classList.add("visible");
            restoreVisibility = true;
        }

        const tipW = tip.offsetWidth;
        const tipH = tip.offsetHeight;

        // Convert hitbox from INTRINSIC -> DISPLAY
        const hitDX = hit.x / scaleX;
        const hitDY = hit.y / scaleY;
        const hitDW = hit.width / scaleX;
        const hitDH = hit.height / scaleY;

        // Initial "below + centered" placement (DISPLAY coords)
        let left = offX + hitDX + (hitDW / 2) - (tipW / 2);
        let top  = offY + hitDY + hitDH + gap;

        // Horizontal clamp to canvas (DISPLAY coords)
        const minLeft = offX;
        const maxLeft = offX + canvasRect.width - tipW;
        left = Math.max(minLeft, Math.min(maxLeft, left));

        // If it would overflow bottom, try flipping above if there's room
        const canvasBottom = offY + canvasRect.height;
        if (top + tipH > canvasBottom && (hitDY - gap - tipH) >= 0) {
            top = offY + hitDY - gap - tipH;
        }

        // Final vertical clamp to canvas
        const minTop = offY;
        const maxTop = offY + canvasRect.height - tipH;
        top = Math.max(minTop, Math.min(maxTop, top));

        // Apply and show
        tip.style.left = `${left}px`;
        tip.style.top  = `${top}px`;

        if (restoreVisibility) tip.style.visibility = "";
        tip.classList.add("visible");
        tip.setAttribute("aria-hidden", "false");
        // --- END POSITIONING ---
    };

    // Mouse out handler to hide tooltip
    const onOut = () => {
        if (active) { debugLog("[tooltips] mouseout"); }
        active = null;
        tip.classList.remove("visible");
        tip.setAttribute("aria-hidden", "true");
    };

    // Attach mouse events
    canvas.addEventListener("mousemove", onMove, { signal });
    canvas.addEventListener("mouseout", onOut, { signal });

    // Provide teardown method to remove all tooltip functionality
    canvas._teardownTooltips = () => {
        controller.abort();
        tip.remove();
        debugLog("[tooltips] teardown");
    };

    debugLog("[tooltips] setup done");
}
