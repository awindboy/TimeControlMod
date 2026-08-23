// iOS-compatible Mindustry script mod.

// Store the selected preset as text. Rhino numbers are java.lang.Double, but
// Mindustry settings only accept its supported boxed types.
const SETTING_SPEED_INDEX = "mindustry-timescale-speed-index";
const SPEEDS = [0.5, 1, 2, 4];
const MIN_SPEED = SPEEDS[0];
const MAX_SPEED = SPEEDS[SPEEDS.length - 1];

let speed = readSpeed();
let mobileControls = null;
let pauseMenuSpeedButton = null;
let pauseMenuHooked = false;

// Keep the normal frame-time calculation and multiply only local gameplay time.
Time.setDeltaProvider(floatp(function(){
    let frameDelta = Core.graphics.getDeltaTime() * 60;
    if(!isFinite(frameDelta) || frameDelta !== frameDelta) frameDelta = 1;

    const localWorld = Vars.state != null
        && Vars.state.isPlaying()
        && (Vars.net == null || !Vars.net.active());

    const multiplier = localWorld ? speed : 1;
    return Mathf.clamp(frameDelta * multiplier, 0.0001, Vars.maxDeltaClient);
}));

Events.run(Trigger.update, run(function(){
    // UI may be initialized after scripts on some mobile builds; retry lazily.
    buildControls();
    handleInput();
}));
Events.on(ClientLoadEvent, cons(function(){
    buildControls();
    print("Time Scale loaded. Speed: " + formatSpeed() + "x");
}));

function buildControls(){
    if(Vars.mobile){
        buildNativePauseControl();
    }else{
        buildDesktopControls();
    }
}

// On iOS, add the control to Mindustry's existing pause/menu dialog. The
// mobile HUD is rebuilt by the game and is not a stable extension point.
function buildNativePauseControl(){
    if(Vars.headless || Vars.ui == null || Vars.ui.paused == null || pauseMenuHooked) return;

    Vars.ui.paused.shown(run(function(){
        addPauseMenuControl();
    }));
    pauseMenuHooked = true;
}

function addPauseMenuControl(){
    if(Vars.ui == null || Vars.ui.paused == null || Vars.ui.paused.cont == null) return;
    if(pauseMenuSpeedButton != null && pauseMenuSpeedButton.parent != null) return;

    const menu = Vars.ui.paused.cont;
    if(menu.find("mindustry-timescale-pause") != null) return;

    const cell = menu.buttonRow("Time Scale: " + formatSpeed() + "×", Icon.play, run(function(){
        cycleSpeed();
    }));
    cell.name("mindustry-timescale-pause");
    pauseMenuSpeedButton = cell.get();
    pauseMenuSpeedButton.update(run(function(){
        pauseMenuSpeedButton.setText("Time Scale: " + formatSpeed() + "×");
    }));
}

function buildDesktopControls(){
    if(Vars.headless || Vars.ui == null || Core.scene == null || mobileControls != null) return;

    mobileControls = new Table();
    mobileControls.name = "mindustry-timescale-controls";
    mobileControls.setFillParent(true);
    mobileControls.touchable = Touchable.childrenOnly;
    // Element.visible is a boolean field in Rhino; assign the dynamic predicate
    // to the separate visibility field instead of calling the Java helper.
    mobileControls.visibility = boolp(function(){
        return Vars.state != null
            && Vars.state.isGame();
    });
    mobileControls.bottom().right();

    mobileControls.table(Styles.black3, function(controls){
        controls.defaults().height(48);
        controls.button("−", Styles.clearTogglet, run(function(){ changeSpeed(-1); }));
        controls.label(prov(function(){ return formatSpeed() + "×"; })).width(60).center();
        controls.button("+", Styles.clearTogglet, run(function(){ changeSpeed(1); }));
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
    const next = Mathf.clamp(index + direction, 0, SPEEDS.length - 1);
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
    speed = Mathf.clamp(value, MIN_SPEED, MAX_SPEED);
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
        if(Mathf.equal(speed, SPEEDS[i])) return i;
    }
    return 1;
}

function formatSpeed(){
    return speed === Math.floor(speed) ? String(Math.floor(speed)) : String(speed);
}
