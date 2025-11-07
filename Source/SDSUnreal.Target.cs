using UnrealBuildTool;
using System.Collections.Generic;

public class SDSUnrealTarget : TargetRules
{
    public SDSUnrealTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        // UE 5.6 build settings and include order
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_6;
        CppStandard = CppStandardVersion.Cpp20;

        // Use shared build environment for installed engine
        BuildEnvironment = TargetBuildEnvironment.Shared;
        // Allow overriding certain settings in shared environment
        bOverrideBuildEnvironment = true;

        // Exclude Developer Tools and Editor-only data from game builds
        bBuildDeveloperTools = false;
        bBuildTargetDeveloperTools = false;
        bBuildWithEditorOnlyData = false;

        // Ensure LiveCoding and Debug Visualizer code paths are disabled in game
        GlobalDefinitions.Add("WITH_LIVECODING=0");
        GlobalDefinitions.Add("WITH_DEBUG_VISUALIZER=0");

        // Game modules
        ExtraModuleNames.AddRange(new string[] { "UnrealCpp" });
    }
}