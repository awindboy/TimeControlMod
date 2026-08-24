import rhino.Context;
import rhino.ImporterTopLevel;
import rhino.NativeJavaClass;
import rhino.Scriptable;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Runs scripts/main.js with the exact interpreted Rhino mode used by Mindustry on iOS. */
public final class RhinoIosProbe {
    public interface EventCallback {
        void get(Object event);
    }

    public interface Action {
        void run();
    }

    public static final class HostEvents {
        private final Map<String, EventCallback> events = new LinkedHashMap<>();
        private final Map<String, Action> triggers = new LinkedHashMap<>();

        public void on(Object type, EventCallback callback) {
            events.put(Context.toString(type), callback);
        }

        public void run(Object type, Action callback) {
            triggers.put(Context.toString(type), callback);
        }

        public void fire(String type) {
            require(events.containsKey(type), "Missing event registration: " + type);
            events.get(type).get(null);
        }

        public void fireTrigger(String type) {
            require(triggers.containsKey(type), "Missing trigger registration: " + type);
            triggers.get(type).run();
        }

        public boolean hasEvent(String type) {
            return events.containsKey(type);
        }

        public boolean hasTrigger(String type) {
            return triggers.containsKey(type);
        }
    }

    public static final class HostHud {
        private final StringBuilder messages = new StringBuilder();

        public void showToast(String message) {
            if (messages.length() > 0) messages.append("|");
            messages.append(message);
        }

        public String messages() {
            return messages.toString();
        }
    }

    public static final class HostState {
        public boolean isPlaying() {
            return true;
        }
    }

    public static final class HostNet {
        public boolean active() {
            return false;
        }
    }

    public static final class HostTime {
        public static float delta = 1f;
        public static float timeScale = 1f;
    }

    public static final class HostBlock {
        public final String name;

        public HostBlock(String name) {
            this.name = name;
        }
    }

    public static final class HostBuild {
        public HostBlock block;
        public boolean enabled;

        public HostBuild(String blockName, boolean enabled) {
            this.block = new HostBlock(blockName);
            this.enabled = enabled;
        }
    }

    public static final class HostBuildGroup {
        private final HostBuild[] builds = {
            new HostBuild("copper-wall", true),
            new HostBuild("mindustry-timescale-time-scale-double", true)
        };

        public int size() {
            return builds.length;
        }

        public HostBuild index(int index) {
            return builds[index];
        }

        public void setSpeedBlock(String blockName, boolean enabled) {
            builds[1].block = new HostBlock(blockName);
            builds[1].enabled = enabled;
        }
    }

    public static final class HostGroups {
        public static final HostBuildGroup build = new HostBuildGroup();
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void selectSpeed(HostEvents events, String blockName, boolean enabled, float expected) {
        HostGroups.build.setSpeedBlock(blockName, enabled);
        for (int i = 0; i < 10; i++) events.fireTrigger("frame");
        require(HostTime.timeScale == expected,
            "Expected " + blockName + " enabled=" + enabled + " to set Time.timeScale=" + expected
                + ", got " + HostTime.timeScale);
    }

    public static void main(String[] args) throws Exception {
        Context context = Context.enter();
        context.setOptimizationLevel(-1);

        try {
            Scriptable scope = new ImporterTopLevel(context);
            HostEvents events = new HostEvents();
            HostHud hud = new HostHud();

            scope.put("Events", scope, Context.javaToJS(events, scope));
            scope.put("Time", scope, new NativeJavaClass(scope, HostTime.class));
            scope.put("Groups", scope, new NativeJavaClass(scope, HostGroups.class));
            scope.put("TestHud", scope, Context.javaToJS(hud, scope));
            scope.put("TestState", scope, Context.javaToJS(new HostState(), scope));
            scope.put("TestNet", scope, Context.javaToJS(new HostNet(), scope));

            context.evaluateString(scope,
                "var Vars={ios:true,mobile:true,headless:false,ui:{hudfrag:TestHud}," +
                "state:TestState,net:TestNet};" +
                "var ClientLoadEvent='client'; var WorldLoadEvent='world';" +
                "var ConfigEvent='config'; var Trigger={beforeGameUpdate:'frame',update:'update'};",
                "ios-host.js", 1);

            String script = Files.readString(Path.of("scripts", "main.js"), StandardCharsets.UTF_8);
            context.evaluateString(scope, "(function(){'use strict';\n" + script + "\n})();",
                "mindustry-timescale/main.js", 1);

            require(events.hasEvent("client"), "ClientLoadEvent was not registered");
            require(events.hasEvent("world"), "WorldLoadEvent was not registered");
            require(events.hasTrigger("frame"), "beforeGameUpdate was not registered");

            events.fire("client");
            events.fire("world");
            selectSpeed(events, "mindustry-timescale-time-scale-double", true, 2f);
            selectSpeed(events, "mindustry-timescale-time-scale-half", true, 0.5f);
            selectSpeed(events, "mindustry-timescale-time-scale-normal", true, 1f);
            selectSpeed(events, "mindustry-timescale-time-scale-quad", true, 4f);
            selectSpeed(events, "mindustry-timescale-time-scale-quad", false, 1f);

            require(hud.messages().contains("v0.5.9"), "Missing client-load toast: " + hud.messages());
            require(hud.messages().contains("ready"), "Missing world-load toast: " + hud.messages());
            require(hud.messages().contains("Time Scale:[] 2"), "Missing 2x toast: " + hud.messages());

            System.out.println("iOS Rhino probe passed: Time.timeScale=" + HostTime.timeScale);
            System.out.println("Toasts: " + hud.messages());
        } finally {
            Context.exit();
        }
    }
}
