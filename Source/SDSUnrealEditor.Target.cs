using UnrealBuildTool;
using System.Collections.Generic;

public class SDSUnrealEditorTarget : TargetRules
{
    public SDSUnrealEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.AddRange(new string[] { "UnrealCpp" });
    }
}