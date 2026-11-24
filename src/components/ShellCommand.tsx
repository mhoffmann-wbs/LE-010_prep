import { promptFor } from '../vm/config'

/** A line that continues the command above it, which bash prompts for with "> ". */
const continues = (prev: string, line: string) => /(\\|\||&&|\bdo|\bthen|\belse|\{)\s*$/.test(prev) || /^\s+\S|^(done|fi|esac|\})\b/.test(line)

/**
 * Commands as they'd appear in the user's terminal: a prompt before each command,
 * "> " before lines that continue one (after a trailing `\` or `|`, inside a
 * loop or an if).
 */
export function ShellCommand({ command, user }: { command: string; user?: string }) {
  const prompt = promptFor(user)
  const lines = command.split('\n')
  return (
    <pre className="overflow-x-auto rounded-lg bg-code p-3 font-mono text-sm text-[#e6edf3]">
      {lines.map((line, i) => (
        <span key={i}>
          <span className="select-none text-[#8fd9ad]">{i > 0 && continues(lines[i - 1]!, line) ? '> ' : prompt}</span>
          {line}
          {i < lines.length - 1 && '\n'}
        </span>
      ))}
    </pre>
  )
}
