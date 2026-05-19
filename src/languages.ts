import { angularLanguage } from "@codemirror/lang-angular";
import { lessLanguage } from "@codemirror/lang-less";
import { liquidLanguage } from "@codemirror/lang-liquid";
import { sassLanguage } from "@codemirror/lang-sass";
import { vueLanguage } from "@codemirror/lang-vue";
import { wastLanguage } from "@codemirror/lang-wast";
import { svelteLanguage } from "@replit/codemirror-lang-svelte";
import type { LanguageConfig } from "./types";
const WASM_LANGUAGE: LanguageConfig = {
  id: "wasm",
  aliases: ["wat", "wast", "webassembly"],
  parserLanguage: wastLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "\\(;[\\s\\S]*?;\\)|;;.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\[\\s\\S]|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:module|func|param|result|local|global|memory|table|elem|data|type|import|export|start|if|then|else|end|block|loop|br|br_if|br_table|return|call|call_indirect|local\\.get|local\\.set|local\\.tee|global\\.get|global\\.set|memory\\.(?:size|grow|copy|fill|init)|table\\.(?:get|set|size|grow|fill|copy|init)|drop|select|nop|unreachable)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:i32|i64|f32|f64|v128|funcref|externref)\\b(?:\\.[A-Za-z0-9_.$-]+)?"
    },
    {
      name: "number",
      pattern: "[-+]?\\b(?:0x[\\da-fA-F](?:[\\da-fA-F_]*\\.?[\\da-fA-F_]*)?|\\d(?:[\\d_]*\\.?[\\d_]*))(?:[eEpP][-+]?\\d[\\d_]*)?\\b|\\b(?:inf|nan(?::0x[\\da-fA-F_]+)?)\\b"
    },
    {
      name: "variable",
      pattern: "\\$[\\w!#$%&'*+./:<=>?@\\\\^`|~-]+"
    },
    {
      name: "operator",
      pattern: "[()]"
    }
  ]
};

const ZIG_LANGUAGE: LanguageConfig = {
  id: "zig",
  tokens: [
    {
      name: "comment",
      pattern: "//.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:addrspace|align|allowzero|and|anyframe|anytype|asm|async|await|break|callconv|catch|comptime|const|continue|defer|else|enum|errdefer|error|export|extern|fn|for|if|inline|linksection|noalias|noinline|nosuspend|null|opaque|or|orelse|packed|pub|resume|return|struct|suspend|switch|test|threadlocal|try|union|unreachable|usingnamespace|var|volatile|while)\\b"
    },
    {
      name: "builtin",
      pattern: "@[A-Za-z_][A-Za-z0-9_]*|\\b(?:bool|void|noreturn|type|anyerror|comptime_int|comptime_float|isize|usize|i\\d+|u\\d+|f16|f32|f64|f80|f128)\\b"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F_]+|0b[01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][-+]?\\d[\\d_]*)?)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()"
    },
    {
      name: "operator",
      pattern: "[-+*/%=!<>|&~^?:]+|\\.\\.?|[{}()[\\],;]"
    }
  ]
};

const NIX_LANGUAGE: LanguageConfig = {
  id: "nix",
  aliases: ["nixos"],
  tokens: [
    {
      name: "comment",
      pattern: "#.*|/\\*[\\s\\S]*?\\*/",
      greedy: true
    },
    {
      name: "string",
      pattern: "''[\\s\\S]*?''|\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:assert|else|if|in|inherit|let|or|rec|then|with)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:abort|baseNameOf|builtins|derivation|dirOf|fetchTarball|import|isNull|map|placeholder|removeAttrs|throw|toString)\\b"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "property",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_'-]*(?=\\s*=)"
    },
    {
      name: "operator",
      pattern: "[-+*/!<>=&|?:@]+|\\.\\.\\.?|[{}()[\\],;]"
    }
  ]
};

const HCL_LANGUAGE: LanguageConfig = {
  id: "hcl",
  aliases: ["terraform", "tf", "tfvars"],
  tokens: [
    {
      name: "comment",
      pattern: "#.*|//.*|/\\*[\\s\\S]*?\\*/",
      greedy: true
    },
    {
      name: "string",
      pattern: "<<-?\\w+[\\s\\S]*?\\n\\w+|\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:resource|data|provider|variable|output|module|locals|terraform|dynamic|for|in|if|null|true|false)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:count|each|for_each|depends_on|lifecycle|provisioner|connection|source|version|required_providers|required_version|backend)\\b"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "property",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_-]*(?=\\s*=)"
    },
    {
      name: "variable",
      pattern: "\\b(?:var|local|module|data|path|terraform|each|self)\\.[A-Za-z0-9_.-]+"
    },
    {
      name: "operator",
      pattern: "=>|==|!=|<=|>=|&&|\\|\\||[-+*/%<>=!?:]+|[{}()[\\],.]"
    }
  ]
};

const KUSTO_LANGUAGE: LanguageConfig = {
  id: "kusto",
  aliases: ["kql"],
  tokens: [
    {
      name: "comment",
      pattern: "//.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "@?\"(?:\"\"|\\\\.|[^\"\\\\])*\"|'(?:''|\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:let|where|project|project-away|extend|summarize|by|join|kind|on|union|take|limit|top|order|sort|asc|desc|render|evaluate|parse|mv-expand|distinct|count|datatable|between|contains|has|in|and|or|not)\\b",
      flags: "i"
    },
    {
      name: "builtin",
      pattern: "\\b(?:ago|bin|case|datetime|dynamic|iff|isnotempty|isnull|isempty|now|strcat|split|tolower|toupper|tostring|toint|tolong|todouble|summarize|countif|dcount|make_set|make_list)\\b",
      flags: "i"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "operator",
      pattern: "\\|\\||[|=<>!~+-/*%,.;()[\\]{}]"
    }
  ]
};

const AUTOHOTKEY_LANGUAGE: LanguageConfig = {
  id: "autohotkey",
  aliases: ["ahk"],
  tokens: [
    {
      name: "comment",
      pattern: ";.*|/\\*[\\s\\S]*?\\*/",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\"\"|`.|[^\"])*\"|'(?:''|`.|[^'])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:if|else|return|global|local|static|class|extends|try|catch|finally|throw|loop|while|for|in|break|continue|switch|case|default|goto|gosub|new|and|or|not)\\b",
      flags: "i"
    },
    {
      name: "builtin",
      pattern: "\\b(?:MsgBox|Send|SendInput|Click|Sleep|Run|WinWait|WinActivate|Hotkey|SetTimer|InputBox|FileRead|FileAppend|RegRead|RegWrite|StrSplit|SubStr|InStr|Format)\\b",
      flags: "i"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F]+|\\d+(?:\\.\\d+)?)\\b"
    },
    {
      name: "variable",
      pattern: "%[A-Za-z_][A-Za-z0-9_]*%|\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*:=)"
    },
    {
      name: "operator",
      pattern: "::|:=|=>|==|!=|<=|>=|&&|\\|\\||[-+*/%=!<>.&|^~?:]+|[{}()[\\],.]"
    }
  ]
};

const GDSCRIPT_LANGUAGE: LanguageConfig = {
  id: "gdscript",
  aliases: ["gd"],
  tokens: [
    {
      name: "comment",
      pattern: "#.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:and|as|assert|await|break|breakpoint|class|class_name|const|continue|elif|else|enum|extends|for|func|if|in|is|match|not|or|pass|preload|return|self|signal|static|super|tool|var|while|yield)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:Array|Basis|Callable|Color|Dictionary|Node|Node2D|Object|PackedScene|Quaternion|Rect2|Resource|SceneTree|Signal|String|StringName|Transform2D|Transform3D|Vector2|Vector3|Vector4|bool|float|int|void)\\b|@[A-Za-z_][A-Za-z0-9_]*"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F_]+|0b[01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()"
    },
    {
      name: "operator",
      pattern: ":=|==|!=|<=|>=|&&|\\|\\||[-+*/%=!<>.&|^~?:]+|[{}()[\\],.]"
    }
  ]
};

const MLIR_LANGUAGE: LanguageConfig = {
  id: "mlir",
  tokens: [
    {
      name: "comment",
      pattern: "//.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:affine_map|affine_set|attributes|dense|false|func|loc|module|none|return|strided|true|type|unit)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:bf16|f16|f32|f64|i1|i8|i16|i32|i64|index|memref|tensor|vector)\\b(?:<[^>]+>)?"
    },
    {
      name: "number",
      pattern: "[-+]?\\b(?:0x[\\da-fA-F]+|\\d+(?:\\.\\d+)?)\\b"
    },
    {
      name: "variable",
      pattern: "%[A-Za-z0-9_.$-]+|#[A-Za-z0-9_.$-]+|@[A-Za-z0-9_.$-]+|![A-Za-z0-9_.$-]+"
    },
    {
      name: "operator",
      pattern: "->|=>|[{}()[\\],:=<>*x?]|\\.\\.\\."
    }
  ]
};

const LEAN_LANGUAGE: LanguageConfig = {
  id: "lean",
  aliases: ["lean4"],
  tokens: [
    {
      name: "comment",
      pattern: "--.*|/-[\\s\\S]*?-/",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:abbrev|axiom|by|calc|case|class|def|deriving|do|else|end|example|extends|forall|fun|if|import|in|inductive|infix|instance|let|macro|match|mutual|namespace|open|opaque|partial|private|protected|public|rec|section|simp|structure|syntax|termination_by|then|theorem|universe|variable|where|with)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:Bool|Char|False|Fin|Float|IO|Int|List|Nat|Option|Prop|Set|Sort|String|Subtype|True|Type|UInt8|UInt16|UInt32|UInt64|Unit)\\b"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_'.]*(?=\\s*(?:\\{|\\(|:|:=))"
    },
    {
      name: "operator",
      pattern: "=>|:=|->|<-|←|→|↔|∀|∃|λ|fun|[{}()[\\],.:;=<>+\\-*/|&!?'^]+"
    }
  ]
};

const ANGULAR_LANGUAGE: LanguageConfig = {
  id: "angular",
  aliases: ["ng"],
  parserLanguage: angularLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "<!--[\\s\\S]*?-->|/\\*[\\s\\S]*?\\*/|//.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:as|async|else|false|for|if|let|null|of|then|track|true|undefined)\\b|@[A-Za-z][A-Za-z0-9_-]*|\\*(?:ngFor|ngIf|ngSwitchCase|ngSwitchDefault)"
    },
    {
      name: "builtin",
      pattern: "\\b(?:ngClass|ngFor|ngIf|ngModel|ngStyle|ngSwitch|ngTemplateOutlet)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\()"
    },
    {
      name: "property",
      pattern: "\\[\\(?[A-Za-z0-9_.:-]+\\)?\\]|\\([A-Za-z0-9_.:-]+\\)|#[A-Za-z_][A-Za-z0-9_-]*|\\b[A-Za-z_:][-A-Za-z0-9_:]*(?=\\s*=)|</?\\s*[A-Za-z][A-Za-z0-9:.-]*"
    },
    {
      name: "operator",
      pattern: "\\{\\{|\\}\\}|=>|===|!==|==|!=|<=|>=|&&|\\|\\||\\?\\.|[-+*/%=!<>.&|^~?:]+|[{}()[\\],.;]"
    }
  ]
};

const VUE_LANGUAGE: LanguageConfig = {
  id: "vue",
  parserLanguage: vueLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "<!--[\\s\\S]*?-->|/\\*[\\s\\S]*?\\*/|//.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:as|await|break|case|catch|class|const|continue|default|else|export|extends|finally|for|from|function|get|if|import|in|let|new|return|set|switch|throw|try|typeof|var|while|yield)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:computed|defineEmits|defineExpose|defineProps|false|null|onMounted|reactive|ref|true|undefined|watch)\\b"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F_]+|0b[01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][-+]?\\d[\\d_]*)?)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\()"
    },
    {
      name: "property",
      pattern: "\\b(?:v-[A-Za-z0-9:-]+|@[A-Za-z0-9:-]+|:[A-Za-z0-9:-]+|#[A-Za-z0-9:-]+)\\b|\\b[A-Za-z_:][-A-Za-z0-9_:]*(?=\\s*=)|</?\\s*[A-Za-z][A-Za-z0-9:.-]*"
    },
    {
      name: "operator",
      pattern: "\\{\\{|\\}\\}|=>|===|!==|==|!=|<=|>=|&&|\\|\\||\\?\\.|[-+*/%=!<>.&|^~?:]+|[{}()[\\],.;]"
    }
  ]
};

const LIQUID_LANGUAGE: LanguageConfig = {
  id: "liquid",
  aliases: ["shopify"],
  parserLanguage: liquidLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "\\{%\\s*comment\\s*%\\}[\\s\\S]*?\\{%\\s*endcomment\\s*%\\}",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\{%-?\\s*(?:assign|break|capture|case|comment|continue|cycle|decrement|else|elsif|endcase|endcapture|endcomment|endfor|endif|for|if|include|increment|layout|liquid|paginate|raw|render|tablerow|unless|when)\\b|\\b(?:and|contains|in|or|reversed)\\b"
    },
    {
      name: "builtin",
      pattern: "\\|\\s*[A-Za-z_][A-Za-z0-9_]*"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "variable",
      pattern: "\\{\\{[\\s\\S]*?\\}\\}|\\b[A-Za-z_][A-Za-z0-9_.-]*\\b"
    },
    {
      name: "operator",
      pattern: "\\{%-?|-%\\}|\\{\\{|\\}\\}|==|!=|<=|>=|[=<>|.,:()[\\]-]"
    }
  ]
};

const LESS_LANGUAGE: LanguageConfig = {
  id: "less",
  parserLanguage: lessLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "/\\*[\\s\\S]*?\\*/|//.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "@(?:arguments|import|media|supports)\\b|\\b(?:and|from|not|only|to|when)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:calc|clamp|darken|fade|hsl|hsla|lighten|linear-gradient|mix|rgb|rgba|var)\\b"
    },
    {
      name: "number",
      pattern: "[-+]?\\b\\d+(?:\\.\\d+)?(?:%|[a-z]+)?\\b"
    },
    {
      name: "variable",
      pattern: "@[A-Za-z_][A-Za-z0-9_-]*"
    },
    {
      name: "property",
      pattern: "\\b-?[A-Za-z_][A-Za-z0-9_-]*(?=\\s*:)|[.#][A-Za-z_][A-Za-z0-9_-]*"
    },
    {
      name: "operator",
      pattern: "[-+*/%=!<>~|]+|[{}()[\\],;:]"
    }
  ]
};

const SASS_LANGUAGE: LanguageConfig = {
  id: "sass",
  aliases: ["scss"],
  parserLanguage: sassLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "/\\*[\\s\\S]*?\\*/|//.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "@(?:content|debug|each|else|error|extend|for|forward|function|if|import|include|media|mixin|return|use|warn|while)\\b|\\b(?:and|from|not|or|through|to)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:calc|clamp|darken|hsl|hsla|lighten|linear-gradient|map-get|mix|rgb|rgba|var)\\b"
    },
    {
      name: "number",
      pattern: "[-+]?\\b\\d+(?:\\.\\d+)?(?:%|[a-z]+)?\\b"
    },
    {
      name: "variable",
      pattern: "\\$[A-Za-z_][A-Za-z0-9_-]*"
    },
    {
      name: "property",
      pattern: "\\b-?[A-Za-z_][A-Za-z0-9_-]*(?=\\s*:)|[.#][A-Za-z_][A-Za-z0-9_-]*"
    },
    {
      name: "operator",
      pattern: "[-+*/%=!<>~|]+|[{}()[\\],;:]"
    }
  ]
};

const SVELTE_LANGUAGE: LanguageConfig = {
  id: "svelte",
  aliases: ["sv"],
  parserLanguage: svelteLanguage,
  preferPrism: true,
  tokens: [
    {
      name: "comment",
      pattern: "<!--[\\s\\S]*?-->|/\\*[\\s\\S]*?\\*/|//.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\{[#/:@](?:if|else|each|await|then|catch|key|html|debug|const|render|snippet)\\b|\\b(?:as|await|break|case|catch|class|const|continue|default|else|export|extends|finally|for|from|function|get|if|import|in|let|new|return|set|switch|throw|try|typeof|var|while|yield)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:Array|Boolean|Date|Error|JSON|Map|Math|Number|Object|Promise|Set|String|console|document|false|null|onMount|true|undefined|window)\\b|\\$[A-Za-z_][A-Za-z0-9_$]*"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F_]+|0b[01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][-+]?\\d[\\d_]*)?)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\()"
    },
    {
      name: "property",
      pattern: "\\b[A-Za-z_:][-A-Za-z0-9_:]*(?=\\s*=)|</?\\s*[A-Za-z][A-Za-z0-9:.-]*"
    },
    {
      name: "operator",
      pattern: "=>|===|!==|==|!=|<=|>=|&&|\\|\\||\\?\\.|[-+*/%=!<>.&|^~?:]+|[{}()[\\],.;]"
    }
  ]
};

export const BUILT_IN_LANGUAGES: LanguageConfig[] = [
  WASM_LANGUAGE,
  ZIG_LANGUAGE,
  NIX_LANGUAGE,
  HCL_LANGUAGE,
  KUSTO_LANGUAGE,
  AUTOHOTKEY_LANGUAGE,
  GDSCRIPT_LANGUAGE,
  MLIR_LANGUAGE,
  LEAN_LANGUAGE,
  ANGULAR_LANGUAGE,
  VUE_LANGUAGE,
  LIQUID_LANGUAGE,
  LESS_LANGUAGE,
  SASS_LANGUAGE,
  SVELTE_LANGUAGE
];
