// Mindustry wraps this file in a strict-mode function. Keep only one local
// state object, and register iOS callbacks directly as the official examples
// do. Extra wrapper/helper calls during startup can break in iOS interpreted
// Rhino before any event listener is registered.

var ts = {};

ts.speed = 1;
ts.speeds = [0.5, 1, 2, 4, 10];
ts.settingKey = "mindustry-timescale-speed-index";
ts.desktopControls = null;
ts.mobileControls = null;
ts.mobilePanel = null;
ts.mobileSpeedIndex = 1;

// The iOS path is deliberately self-contained. Do not route these callbacks
// through local registration helpers: Mindustry 159.7 runs Rhino with the
// interpreter enabled on iOS, and direct Java interface conversion is stable.
if(Vars.ios){
    Events.on(ClientLoadEvent, () => {
        ts.speed = 1;
        ts.mobileSpeedIndex = 1;

        if(Core.scene != null && ts.mobileControls == null){
            ts.mobileControls = new Table();
            ts.mobileControls.name = "mindustry-timescale-mobile-controls";
            ts.mobileControls.setFillParent(true);
            ts.mobileControls.touchable = Touchable.childrenOnly;
            ts.mobileControls.visibility = () => Vars.state != null
                && Vars.state.isGame()
                && Vars.ui != null
                && Vars.ui.hudfrag != null
                && Vars.ui.hudfrag.shown == true;
            ts.mobileControls.top().left();
            // Scene.root already excludes safe-area margins. The native mobile
            // toolbar contains five 65-unit buttons and a 4-unit divider.
            ts.mobileControls.marginLeft(329);

            ts.mobilePanel = new Table(Styles.black6);
            ts.mobilePanel.name = "mindustry-timescale-mobile-panel";
            ts.mobilePanel.left();
            ts.mobilePanel.defaults().height(52);

            ts.mobilePanel.button("◀", Styles.clearTogglet, () => {
                if(Vars.net != null && Vars.net.active()){
                    ts.speed = 1;
                    ts.mobileSpeedIndex = 1;
                    Vars.ui.hudfrag.showToast("Time Scale is disabled in multiplayer");
                    return;
                }
                ts.mobileSpeedIndex = ts.mobileSpeedIndex - 1;
                if(ts.mobileSpeedIndex < 0) ts.mobileSpeedIndex = ts.speeds.length - 1;
                ts.speed = ts.speeds[ts.mobileSpeedIndex];
            }).size(52).name("mindustry-timescale-left");

            ts.mobilePanel.label(() => ts.speed + "×")
                .style(Styles.outlineLabel).width(70).labelAlign(Align.center)
                .name("mindustry-timescale-value");

            ts.mobilePanel.button("▶", Styles.clearTogglet, () => {
                if(Vars.net != null && Vars.net.active()){
                    ts.speed = 1;
                    ts.mobileSpeedIndex = 1;
                    Vars.ui.hudfrag.showToast("Time Scale is disabled in multiplayer");
                    return;
                }
                ts.mobileSpeedIndex = ts.mobileSpeedIndex + 1;
                if(ts.mobileSpeedIndex >= ts.speeds.length) ts.mobileSpeedIndex = 0;
                ts.speed = ts.speeds[ts.mobileSpeedIndex];
            }).size(52).name("mindustry-timescale-right");

            ts.mobileControls.add(ts.mobilePanel).left();
            Core.scene.add(ts.mobileControls);
            ts.mobileControls.toFront();
        }

        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("[accent]Time Scale v0.6.1[] loaded");
        }
    });

    Events.on(WorldLoadEvent, () => {
        ts.speed = 1;
        ts.mobileSpeedIndex = 1;
        if(Vars.ui != null && Vars.ui.hudfrag != null){
            Vars.ui.hudfrag.showToast("[accent]Time Scale:[] ready");
        }
    });

    Events.run(Trigger.beforeGameUpdate, () => {
        if(Vars.state == null || !Vars.state.isPlaying()) return;
        if(Vars.net != null && Vars.net.active()){
            ts.speed = 1;
            return;
        }
        Time.delta = Time.delta * ts.speed;
    });

}else{
    // Desktop keeps the native-looking HUD controls and keyboard shortcuts.
    Events.on(ClientLoadEvent, function(event){
        ts.speed = ts.readSpeed();
        ts.buildDesktopControls();
        ts.showToast("[accent]Time Scale v0.6.1[] loaded");
    });

    Events.on(WorldLoadEvent, function(event){
        ts.showToast("[accent]Time Scale:[] ready");
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
