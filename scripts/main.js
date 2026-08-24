// Mindustry wraps this file in a strict-mode function. Keep only one local
// state object, and register iOS callbacks directly as the official examples
// do. Extra wrapper/helper calls during startup can break in iOS interpreted
// Rhino before any event listener is registered.

var ts = {};

ts.speed = 1;
ts.speeds = [0.5, 1, 2, 4];
ts.settingKey = "mindustry-timescale-speed-index";
ts.desktopControls = null;
ts.scanTick = 0;
ts.scanIndex = 0;
ts.scanBuild = null;
ts.scanBlockName = "";
ts.nextSpeed = 1;

// The iOS path is deliberately self-contained. Do not route these callbacks
// through local registration helpers: Mindustry 159.7 runs Rhino with the
// interpreter enabled on iOS, and direct Java interface conversion is stable.
if(Vars.ios){
    Events.on(ClientLoadEvent, () => {
        ts.speed = 1;
        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("[accent]Time Scale v0.5.10[] loaded");
        }
    });

    Events.on(WorldLoadEvent, () => {
        ts.speed = 1;
        ts.scanTick = 0;
        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("[accent]Time Scale:[] ready - tap a Time Scale block");
        }
    });

    // ConfigEvent passes an argument, which triggers a broken local-variable
    // path in the iOS Rhino interpreter. Poll the existing building group by
    // index instead; this uses no parameterized JavaScript callback at all.
    Events.run(Trigger.beforeGameUpdate, () => {
        if(Vars.state == null || !Vars.state.isPlaying()) return;
        if(Vars.net != null && Vars.net.active()){
            ts.speed = 1;
            return;
        }

        ts.scanTick = ts.scanTick + 1;
        if(ts.scanTick < 10){
            Time.delta = Time.delta * ts.speed;
            return;
        }

        ts.scanTick = 0;
        ts.scanIndex = 0;
        ts.nextSpeed = 1;

        while(ts.scanIndex < Groups.build.size()){
            ts.scanBuild = Groups.build.index(ts.scanIndex);
            if(ts.scanBuild != null && ts.scanBuild.block != null && ts.scanBuild.enabled == true){
                ts.scanBlockName = ts.scanBuild.block.name + "";
                if(ts.scanBlockName == "mindustry-timescale-time-scale-half"){
                    ts.nextSpeed = 0.5;
                    break;
                }else if(ts.scanBlockName == "mindustry-timescale-time-scale-normal"){
                    ts.nextSpeed = 1;
                    break;
                }else if(ts.scanBlockName == "mindustry-timescale-time-scale-double"){
                    ts.nextSpeed = 2;
                    break;
                }else if(ts.scanBlockName == "mindustry-timescale-time-scale-quad"){
                    ts.nextSpeed = 4;
                    break;
                }
            }
            ts.scanIndex = ts.scanIndex + 1;
        }

        if(ts.speed != ts.nextSpeed){
            ts.speed = ts.nextSpeed;
            if(Vars.ui != null && Vars.ui.hudfrag != null){
                Vars.ui.hudfrag.showToast("[accent]Time Scale:[] " + ts.speed + "×");
            }
        }
        Time.delta = Time.delta * ts.speed;
    });

}else{
    // Desktop keeps the native-looking HUD controls and keyboard shortcuts.
    Events.on(ClientLoadEvent, function(event){
        ts.speed = ts.readSpeed();
        ts.buildDesktopControls();
        ts.showToast("[accent]Time Scale v0.5.10[] loaded");
    });

    Events.on(WorldLoadEvent, function(event){
        ts.showToast("[accent]Time Scale:[] ready");
    });

    Events.on(ConfigEvent, function(event){
        ts.handleDesktopConfig(event);
    });

    Events.run(Trigger.beforeGameUpdate, function(){
        ts.applyDesktopDelta();
    });

    Events.run(Trigger.update, function(){
        ts.buildDesktopControls();
        ts.handleDesktopInput();
    });

    Time.setDeltaProvider(function(){
        return ts.scaledDelta();
    });
}

ts.showToast = function(message){
    if(Vars.ui != null && Vars.ui.hudfrag != null){
        Vars.ui.hudfrag.showToast(message);
    }
};

ts.scaledDelta = function(){
    var frameDelta = Core.graphics.getDeltaTime() * 60;
    if(frameDelta != frameDelta || frameDelta <= 0) frameDelta = 1;

    var multiplier = 1;
    if(Vars.state != null && Vars.state.isPlaying() && (Vars.net == null || !Vars.net.active())){
        multiplier = ts.speed;
    }

    var scaled = frameDelta * multiplier;
    if(scaled < 0.0001) scaled = 0.0001;
    if(scaled > Vars.maxDeltaClient) scaled = Vars.maxDeltaClient;
    return scaled;
};

ts.applyDesktopDelta = function(){
    if(Vars.state == null || !Vars.state.isPlaying()) return;
    if(Vars.net != null && Vars.net.active()) ts.speed = 1;
    Time.delta = ts.scaledDelta();
};

ts.handleDesktopConfig = function(event){
    if(event == null || event.tile == null || event.tile.block == null) return;

    var blockName = event.tile.block.name + "";
    var selectedSpeed = 1;
    if(blockName == "mindustry-timescale-time-scale-half"){
        selectedSpeed = 0.5;
    }else if(blockName == "mindustry-timescale-time-scale-normal"){
        selectedSpeed = 1;
    }else if(blockName == "mindustry-timescale-time-scale-double"){
        selectedSpeed = 2;
    }else if(blockName == "mindustry-timescale-time-scale-quad"){
        selectedSpeed = 4;
    }else{
        return;
    }

    if(Vars.net != null && Vars.net.active()){
        ts.setSpeed(1, true);
        return;
    }
    if(Vars.state == null || !Vars.state.isPlaying()) return;
    ts.setSpeed(event.tile.enabled == true ? selectedSpeed : 1, true);
};

ts.buildDesktopControls = function(){
    if(Vars.headless || Vars.ui == null || Core.scene == null || ts.desktopControls != null) return;

    ts.desktopControls = new Table();
    ts.desktopControls.name = "mindustry-timescale-controls";
    ts.desktopControls.setFillParent(true);
    ts.desktopControls.touchable = Touchable.childrenOnly;
    ts.desktopControls.visibility = function(){
        return Vars.state != null && Vars.state.isGame();
    };
    ts.desktopControls.bottom().right();

    ts.desktopControls.table(Styles.black3, function(controls){
        controls.defaults().height(48);
        controls.button("−", Styles.clearTogglet, function(){ ts.changeSpeed(-1); });
        controls.label(function(){ return ts.formatSpeed() + "×"; }).width(60).center();
        controls.button("+", Styles.clearTogglet, function(){ ts.changeSpeed(1); });
    }).pad(4).padRight(24).padBottom(88);

    Core.scene.add(ts.desktopControls);
    ts.desktopControls.toFront();
};

ts.handleDesktopInput = function(){
    if(Vars.state == null || !Vars.state.isPlaying()) return;

    if(Vars.net != null && Vars.net.active()){
        if(ts.speed != 1) ts.setSpeed(1, false);
        return;
    }

    if(Core.input.keyTap(KeyCode.f6)){
        ts.changeSpeed(-1);
    }else if(Core.input.keyTap(KeyCode.f7)){
        ts.changeSpeed(1);
    }else if(Core.input.keyTap(KeyCode.f8)){
        ts.setSpeed(1, true);
    }
};

ts.changeSpeed = function(direction){
    if(Vars.net != null && Vars.net.active()){
        ts.showToast("Time Scale is disabled in multiplayer");
        return;
    }

    var next = ts.speedIndex() + direction;
    if(next < 0) next = 0;
    if(next >= ts.speeds.length) next = ts.speeds.length - 1;
    ts.setSpeed(ts.speeds[next], true);
};

ts.setSpeed = function(value, notify){
    if(value < ts.speeds[0]) value = ts.speeds[0];
    if(value > ts.speeds[ts.speeds.length - 1]) value = ts.speeds[ts.speeds.length - 1];
    ts.speed = value;

    try{
        Core.settings.put(ts.settingKey, ts.speedIndex() + "");
    }catch(ignored){
    }

    if(notify) ts.showToast("[accent]Time Scale:[] " + ts.formatSpeed() + "×");
};

ts.readSpeed = function(){
    var parsed = parseInt(Core.settings.getString(ts.settingKey, "1"), 10);
    if(!isFinite(parsed)) return 1;
    if(parsed < 0) parsed = 0;
    if(parsed >= ts.speeds.length) parsed = ts.speeds.length - 1;
    return ts.speeds[parsed];
};

ts.speedIndex = function(){
    for(var i = 0; i < ts.speeds.length; i++){
        var difference = ts.speed - ts.speeds[i];
        if(difference < 0) difference = -difference;
        if(difference < 0.0001) return i;
    }
    return 1;
};

ts.formatSpeed = function(){
    if(ts.speed == 0.5) return "0.5";
    return ts.speed + "";
};
