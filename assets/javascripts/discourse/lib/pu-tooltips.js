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

    // Recalculate bounding rectangles
    const recompute = () => {
        canvasRect = canvas.getBoundingClientRect();
        parentRect = parent.getBoundingClientRect();
        debugLog("[tooltips] recompute rects", { canvasRect, parentRect });
    };
    recompute();
    window.addEventListener("scroll", recompute, { passive: true, signal });
    window.addEventListener("resize", recompute, { signal });

    // Mouse move handler to detect tooltip region hits
    const onMove = (e) => {
        if (!canvasRect || !parentRect) return;
        const lx = e.clientX - canvasRect.left;
        const ly = e.clientY - canvasRect.top;

        // Find the tooltip region under the cursor
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
            tip.style.left = "0px"; tip.style.top = "0px";
            debugLog("[tooltips] enter region");
        }

        // Position tooltip relative to the canvas
        const offX = canvasRect.left - parentRect.left;
        const offY = canvasRect.top - parentRect.top;
        tip.style.left = `${offX + hit.x + hit.width / 2}px`;
        tip.style.top = `${offY + hit.y + hit.height / 2 + 25}px`;
        tip.classList.add("visible");
        tip.setAttribute("aria-hidden", "false");
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