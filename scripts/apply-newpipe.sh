#!/usr/bin/env bash
# Re-apply the on-device NewPipeExtractor resolver to a freshly generated
# gen/android (which `tauri android init` overwrites and which is gitignored).
# Idempotent — safe to run repeatedly. Run from the repo root.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/app/src-tauri/gen/android"
PKG="$GEN/app/src/main/java/fm/treble/app"

[ -d "$GEN" ] || { echo "gen/android not found — run 'npm run android:build' once first"; exit 1; }

# 1. JitPack repo
if ! grep -q "jitpack.io" "$GEN/build.gradle.kts"; then
  perl -0pi -e 's/(allprojects \{\s*repositories \{\s*google\(\)\s*mavenCentral\(\))/$1\n        maven { setUrl("https:\/\/jitpack.io") }/s' "$GEN/build.gradle.kts"
  echo "+ jitpack repo"
fi

# 2. Gradle deps
if ! grep -q "NewPipeExtractor" "$GEN/app/build.gradle.kts"; then
  perl -0pi -e 's/(implementation\("androidx.lifecycle:lifecycle-process[^\n]*\n)/$1    implementation("com.github.TeamNewPipe:NewPipeExtractor:v0.24.6")\n    implementation("org.nanohttpd:nanohttpd:2.3.1")\n/' "$GEN/app/build.gradle.kts"
  echo "+ gradle deps"
fi

# 3. ProGuard keep rules
if ! grep -q "newpipe.extractor" "$GEN/app/proguard-rules.pro"; then
  cat >> "$GEN/app/proguard-rules.pro" <<'PRO'

-keep class org.schabi.newpipe.extractor.** { *; }
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.classfile.** { *; }
-keep class fi.iki.elonen.** { *; }
-keep class fm.treble.app.NewPipeResolver { *; }
-keep class fm.treble.app.NewPipeResolver$* { *; }
-dontwarn org.schabi.newpipe.extractor.**
-dontwarn org.mozilla.javascript.**
-dontwarn javax.annotation.**
PRO
  echo "+ proguard rules"
fi

# 4. Kotlin resolver
cp "$ROOT/android-newpipe/NewPipeResolver.kt" "$PKG/NewPipeResolver.kt"
echo "+ NewPipeResolver.kt"

# 5. Start it from MainActivity
if ! grep -q "NewPipeResolver.start" "$PKG/MainActivity.kt"; then
  perl -0pi -e 's/(super.onCreate\(savedInstanceState\))/$1\n    NewPipeResolver.start()/' "$PKG/MainActivity.kt"
  echo "+ MainActivity hook"
fi
echo "done."

# 6. Release: minify OFF (R8 breaks Rhino) + core library desugaring
APP_GRADLE="$GEN/app/build.gradle.kts"
perl -0pi -e 's/getByName\("release"\) \{\s*isMinifyEnabled = true.*?\n        \}/getByName("release") {\n            isMinifyEnabled = false\n        }/s' "$APP_GRADLE"
if ! grep -q "isCoreLibraryDesugaringEnabled" "$APP_GRADLE"; then
  perl -0pi -e 's/(    kotlinOptions \{)/    compileOptions {\n        isCoreLibraryDesugaringEnabled = true\n        sourceCompatibility = JavaVersion.VERSION_1_8\n        targetCompatibility = JavaVersion.VERSION_1_8\n    }\n$1/' "$APP_GRADLE"
fi
if ! grep -q "desugar_jdk_libs" "$APP_GRADLE"; then
  perl -0pi -e 's/(implementation\("org.nanohttpd[^\n]*\n)/$1    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")\n/' "$APP_GRADLE"
fi
echo "+ release minify off + desugaring"
