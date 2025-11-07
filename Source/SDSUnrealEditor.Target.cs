using UnrealBuildTool;
using System.Collections.Generic;

public class SDSUnrealEditorTarget : TargetRules
{
    public SDSUnrealEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        // UE 5.6 build settings and include order
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_6;
        CppStandard = CppStandardVersion.Cpp20;

        // Use shared build environment for installed engine
        BuildEnvironment = TargetBuildEnvironment.Shared;
        // Do not override build environment when using installed engines
        // bOverrideBuildEnvironment = false; // leave at default

        // Remove debug visualizer macro to avoid unresolved symbol linking
        // GlobalDefinitions.Add("WITH_DEBUG_VISUALIZER=1");

        // Rely on uproject plugin settings; do not explicitly toggle plugins in shared environment
        // DisablePlugins.Add("LiveCoding");
        ExtraModuleNames.AddRange(new string[] { "UnrealCpp" });
    }
}