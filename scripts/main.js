// iOS-compatible Mindustry script mod.

// Store the selected preset as text. Rhino numbers are java.lang.Double, but
// Mindustry settings only accept its supported boxed types.
const SETTING_SPEED_INDEX = "mindustry-timescale-speed-index";
const SPEEDS = [0.5, 1, 2, 4];
const MIN_SPEED = SPEEDS[0];
const MAX_SPEED = SPEEDS[SPEEDS.length - 1];
const SPEED_BLOCK_NAMES = [
    "mindustry-timescale-time-scale-half",
    "mindustry-timescale-time-scale-normal",
    "mindustry-timescale-time-scale-double",
    "mindustry-timescale-time-scale-quad"
];

let speed = readSpeed();
let mobileControls = null;
let speedBlocks = null;
let needsBlockSync = true;
let blockScanTimer = 0;

// Temporary runtime probe for iOS diagnosis. Remove after confirming whether
// main.js and ConfigEvent are reaching the iPad build.
const DIAGNOSTIC_PROBE = true;
let earlyDiagnosticShown = false;

// Register this probe before any time-control API is touched. If a later
// initialization call fails on iOS, this still proves whether main.js ran.
if(DIAGNOSTIC_PROBE){
    Events.on(ClientLoadEvent, function(){
        if(earlyDiagnosticShown || Vars.ui == null || Vars.ui.hudfrag == null) return;

        earlyDiagnosticShown = true;
        Vars.ui.hudfrag.showToast("[accent]Time Scale probe:[] main.js is running");
    });
}

// Keep the normal frame-time calculation and multiply only local gameplay time.
Time.setDeltaProvider(function(){
    return scaledDelta();
});

// Apply the value immediately before Mindustry updates the world. This is a
// fallback for platforms where the Java Floatp provider is not refreshed in
// the native frame loop, and also keeps the block state authoritative.
Events.run(Trigger.beforeGameUpdate, function(){
    if(Vars.state == null || !Vars.state.isPlaying()) return;

    if(++blockScanTimer >= 5 || needsBlockSync){
        blockScanTimer = 0;
        needsBlockSync = false;
        updateBlockControl(false);
    }

    if(Vars.net == null || !Vars.net.active()){
        Time.delta = scaledDelta();
    }
});

Events.run(Trigger.update, function(){
    // UI may be initialized after scripts on some mobile builds; retry lazily.
    buildControls();
    handleInput();
    if(needsBlockSync && Vars.state != null && Vars.state.isPlaying()){
        needsBlockSync = false;
        updateBlockControl(false);
    }
});
Events.on(ConfigEvent, handleSpeedBlockConfig);
Events.on(WorldLoadEvent, function(){
    needsBlockSync = true;
    if(DIAGNOSTIC_PROBE) postDiagnosticToast("Time Scale script active");
});
Events.on(BlockBuildEndEvent, function(){
    needsBlockSync = true;
});
Events.on(BlockDestroyEvent, function(){
    needsBlockSync = true;
});
Events.on(StateChangeEvent, function(){
    needsBlockSync = true;
});
Events.on(ClientLoadEvent, function(){
    loadSpeedBlocks();
    buildControls();
    print("Time Scale loaded. Speed: " + formatSpeed() + "x");
});

function postDiagnosticToast(message){
    if(Vars.ui == null || Vars.ui.hudfrag == null) return;

    Core.app.post(function(){
        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("[accent]Time Scale:[] " + message);
        }
    });
}

function loadSpeedBlocks(){
    if(speedBlocks != null) return;

    speedBlocks = [];
    for(let i = 0; i < SPEED_BLOCK_NAMES.length; i++){
        // Keep only plain JavaScript data here. Looking up ContentLoader.block
        // from Rhino can select the wrong overloaded Java method on iOS.
        speedBlocks.push({name: SPEED_BLOCK_NAMES[i], value: SPEEDS[i]});
    }
}

function scaledDelta(){
    let frameDelta = Core.graphics.getDeltaTime() * 60;
    if(!isFinite(frameDelta) || frameDelta !== frameDelta) frameDelta = 1;

    const localWorld = Vars.state != null
        && Vars.state.isPlaying()
        && (Vars.net == null || !Vars.net.active());

    const multiplier = localWorld ? speed : 1;
    return clampNumber(frameDelta * multiplier, 0.0001, Vars.maxDeltaClient);
}

function speedBlockIndex(build){
    if(build == null || build.block == null) return -1;

    const blockName = String(build.block.name);
    for(let i = 0; i < SPEED_BLOCK_NAMES.length; i++){
        if(blockName == speedBlocks[i].name){
            return i;
        }
    }
    return -1;
}

// SwitchBlock emits ConfigEvent after its enabled field has been updated.
// Use that event for taps so mobile input does not depend on a per-frame scan.
function handleSpeedBlockConfig(event){
    if(speedBlocks == null) loadSpeedBlocks();
    if(speedBlocks == null || event == null || event.tile == null) return;

    const index = speedBlockIndex(event.tile);
    if(index == -1) return;

    if(DIAGNOSTIC_PROBE){
        postDiagnosticToast("block event received");
    }

    if(Vars.net != null && Vars.net.active()){
        if(!sameSpeed(speed, 1)) setSpeed(1, false);
        return;
    }

    if(Vars.state == null || !Vars.state.isPlaying()){
        needsBlockSync = true;
        return;
    }

    if(event.tile.enabled == true){
        needsBlockSync = false;
        setSpeed(SPEEDS[index], !Vars.mobile);
    }else{
        updateBlockControl(!Vars.mobile);
    }
}

// A scan is only needed when a world/building changes or a speed block is
// switched off, so this remains cheap on large campaign maps.
function updateBlockControl(notify){
    if(speedBlocks == null) loadSpeedBlocks();
    if(speedBlocks == null || Vars.state == null || !Vars.state.isPlaying()) return;

    if(Vars.net != null && Vars.net.active()){
        if(!sameSpeed(speed, 1)) setSpeed(1, false);
        return;
    }

    let activeIndex = -1;
    Groups.build.each(function(build){
        if(activeIndex != -1) return;

        const index = speedBlockIndex(build);
        if(index != -1 && build.enabled == true){
            activeIndex = index;
        }
    });

    const nextSpeed = activeIndex == -1 ? 1 : speedBlocks[activeIndex].value;
    if(!sameSpeed(speed, nextSpeed)) setSpeed(nextSpeed, notify && !Vars.mobile);
}

function buildControls(){
    if(!Vars.mobile){
        buildDesktopControls();
    }
}

function buildDesktopControls(){
    if(Vars.headless || Vars.ui == null || Core.scene == null || mobileControls != null) return;

    mobileControls = new Table();
    mobileControls.name = "mindustry-timescale-controls";
    mobileControls.setFillParent(true);
    mobileControls.touchable = Touchable.childrenOnly;
    // Element.visible is a boolean field in Rhino; assign the dynamic predicate
    // to the separate visibility field instead of calling the Java helper.
    mobileControls.visibility = function(){
        return Vars.state != null
            && Vars.state.isGame();
    };
    mobileControls.bottom().right();

    mobileControls.table(Styles.black3, function(controls){
        controls.defaults().height(48);
        controls.button("−", Styles.clearTogglet, function(){ changeSpeed(-1); });
        controls.label(function(){ return formatSpeed() + "×"; }).width(60).center();
        controls.button("+", Styles.clearTogglet, function(){ changeSpeed(1); });
    }).pad(4).padRight(24).padBottom(88);

    // Add to the scene root so the overlay is above the normal HUD fragments.
    Core.scene.add(mobileControls);
    mobileControls.toFront();
}

function handleInput(){
    if(Vars.state == null || !Vars.state.isPlaying()) return;

    if(Vars.net != null && Vars.net.active()){
        if(speed != 1) setSpeed(1, false);
        return;
    }

    if(Core.input.keyTap(KeyCode.f6)){
        changeSpeed(-1);
    }else if(Core.input.keyTap(KeyCode.f7)){
        changeSpeed(1);
    }else if(Core.input.keyTap(KeyCode.f8)){
        setSpeed(1, true);
    }
}

function changeSpeed(direction){
    if(Vars.net != null && Vars.net.active()){
        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("Time Scale is disabled in multiplayer");
        }
        return;
    }
    const index = speedIndex();
    const next = clampNumber(index + direction, 0, SPEEDS.length - 1);
    setSpeed(SPEEDS[next], true);
}

function cycleSpeed(){
    if(Vars.net != null && Vars.net.active()){
        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("Time Scale is disabled in multiplayer");
        }
        return;
    }
    const next = (speedIndex() + 1) % SPEEDS.length;
    setSpeed(SPEEDS[next], true);
}

function setSpeed(value, notify){
    speed = clampNumber(value, MIN_SPEED, MAX_SPEED);
    Core.settings.put(SETTING_SPEED_INDEX, String(speedIndex()));

    if(notify && Vars.ui != null && Vars.ui.hudfrag != null){
        Vars.ui.hudfrag.setHudText("[accent]Time Scale: " + formatSpeed() + "×[]");
        Vars.ui.hudfrag.showToast("Time Scale: " + formatSpeed() + "×");
    }
}

function readSpeed(){
    const parsed = parseInt(Core.settings.getString(SETTING_SPEED_INDEX, "1"), 10);
    if(!isFinite(parsed)) return 1;
    const index = Math.max(0, Math.min(SPEEDS.length - 1, parsed));
    return SPEEDS[index];
}

function speedIndex(){
    for(let i = 0; i < SPEEDS.length; i++){
        if(sameSpeed(speed, SPEEDS[i])) return i;
    }
    return 1;
}

function sameSpeed(a, b){
    return Math.abs(a - b) < 0.0001;
}

function clampNumber(value, min, max){
    return Math.max(min, Math.min(max, value));
}

function formatSpeed(){
    return speed === Math.floor(speed) ? String(Math.floor(speed)) : String(speed);
}
