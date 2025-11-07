using UnrealBuildTool;
using System.Collections.Generic;

public class SDSUnrealTarget : TargetRules
{
    public SDSUnrealTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.AddRange(new string[] { "UnrealCpp" });
    }
}