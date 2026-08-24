import arc.Events;
import arc.util.Time;
import rhino.Context;
import rhino.ImporterTopLevel;
import rhino.NativeJavaClass;
import rhino.Scriptable;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Runs scripts/main.js with the exact interpreted Rhino mode used by Mindustry on iOS. */
public final class RhinoIosProbe {
    public static final class HostClientLoadEvent {
    }

    public static final class HostWorldLoadEvent {
    }

    public static final class HostConfigEvent {
    }

    public enum HostTrigger {
        frame,
        update
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

    private static void selectSpeed(String blockName, boolean enabled, float expected) {
        HostGroups.build.setSpeedBlock(blockName, enabled);
        for (int i = 0; i < 10; i++) {
            // Time.updateGlobal() refreshes this value before beforeGameUpdate.
            Time.delta = 1f;
            Events.fire(HostTrigger.frame);
        }
        require(Time.delta == expected,
            "Expected " + blockName + " enabled=" + enabled + " to set Time.delta=" + expected
                + ", got " + Time.delta);
    }

    public static void main(String[] args) throws Exception {
        Context context = Context.enter();
        context.setOptimizationLevel(-1);

        try {
            Events.clear();
            Scriptable scope = new ImporterTopLevel(context);
            HostHud hud = new HostHud();

            scope.put("Events", scope, new NativeJavaClass(scope, Events.class));
            scope.put("Time", scope, new NativeJavaClass(scope, Time.class));
            scope.put("Groups", scope, new NativeJavaClass(scope, HostGroups.class));
            scope.put("ClientLoadEvent", scope, new NativeJavaClass(scope, HostClientLoadEvent.class));
            scope.put("WorldLoadEvent", scope, new NativeJavaClass(scope, HostWorldLoadEvent.class));
            scope.put("ConfigEvent", scope, new NativeJavaClass(scope, HostConfigEvent.class));
            scope.put("TestTrigger", scope, new NativeJavaClass(scope, HostTrigger.class));
            scope.put("TestHud", scope, Context.javaToJS(hud, scope));
            scope.put("TestState", scope, Context.javaToJS(new HostState(), scope));
            scope.put("TestNet", scope, Context.javaToJS(new HostNet(), scope));

            context.evaluateString(scope,
                "var Vars={ios:true,mobile:true,headless:false,ui:{hudfrag:TestHud}," +
                "state:TestState,net:TestNet};" +
                "var Trigger={beforeGameUpdate:TestTrigger.frame,update:TestTrigger.update};",
                "ios-host.js", 1);

            String script = Files.readString(Path.of("scripts", "main.js"), StandardCharsets.UTF_8);
            context.evaluateString(scope, "(function(){'use strict';\n" + script + "\n})();",
                "mindustry-timescale/main.js", 1);

            Events.fire(new HostClientLoadEvent());
            Events.fire(new HostWorldLoadEvent());
            selectSpeed("mindustry-timescale-time-scale-double", true, 2f);
            selectSpeed("mindustry-timescale-time-scale-half", true, 0.5f);
            selectSpeed("mindustry-timescale-time-scale-normal", true, 1f);
            selectSpeed("mindustry-timescale-time-scale-quad", true, 4f);
            selectSpeed("mindustry-timescale-time-scale-quad", false, 1f);

            require(hud.messages().contains("v0.5.10"), "Missing client-load toast: " + hud.messages());
            require(hud.messages().contains("ready"), "Missing world-load toast: " + hud.messages());
            require(hud.messages().contains("Time Scale:[] 2"), "Missing 2x toast: " + hud.messages());

            System.out.println("iOS Rhino probe passed: Time.delta=" + Time.delta);
            System.out.println("Toasts: " + hud.messages());
        } finally {
            Events.clear();
            Context.exit();
        }
    }
}
