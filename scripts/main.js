// iOS-compatible Mindustry script mod.

const SETTING_SPEED = "mindustry-timescale-speed";
const SPEEDS = [0.5, 1, 2, 4];
const MIN_SPEED = SPEEDS[0];
const MAX_SPEED = SPEEDS[SPEEDS.length - 1];

let speed = readSpeed();
let mobileControls = null;

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
    if(mobileControls == null) buildMobileControls();
    handleInput();
}));
Events.on(ClientLoadEvent, cons(function(){
    print("Time Scale loaded. Speed: " + formatSpeed() + "x");
}));

function buildMobileControls(){
    if(Vars.headless || Vars.ui == null || Vars.ui.hudGroup == null || mobileControls != null) return;

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

    mobileControls.table(Tex.pane, function(controls){
        controls.defaults().size(64);
        controls.button("−", Styles.clearTogglet, run(function(){ changeSpeed(-1); }));
        controls.label(prov(function(){ return formatSpeed() + "x"; })).center();
        controls.button("+", Styles.clearTogglet, run(function(){ changeSpeed(1); }));
    }).padRight(12).padBottom(12);

    Vars.ui.hudGroup.addChild(mobileControls);
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

function setSpeed(value, notify){
    speed = Mathf.clamp(value, MIN_SPEED, MAX_SPEED);
    Core.settings.put(SETTING_SPEED, speed);

    if(notify && Vars.ui != null && Vars.ui.hudfrag != null){
        Vars.ui.hudfrag.setHudText("[accent]Time Scale: " + formatSpeed() + "x[]");
        Vars.ui.hudfrag.showToast("Time Scale: " + formatSpeed() + "x");
    }
}

function readSpeed(){
    const saved = Core.settings.getFloat(SETTING_SPEED, 1);
    for(let i = 0; i < SPEEDS.length; i++){
        if(Mathf.equal(saved, SPEEDS[i])) return SPEEDS[i];
    }
    return 1;
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
