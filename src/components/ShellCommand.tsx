import { promptFor } from '../vm/config'

/** A line that continues the command above it, which bash prompts for with "> ". */
const continues = (prev: string, line: string) => /(\\|\||&&|\bdo|\bthen|\belse|\{)\s*$/.test(prev) || /^\s+\S|^(done|fi|esac|\})\b/.test(line)

/** Which lines bash prompts for with "> ": continued commands, and here-document bodies up to their delimiter. */
function continuations(lines: string[]): boolean[] {
  let heredoc: string | null = null
  return lines.map((line, i) => {
    if (heredoc !== null) {
      if (line === heredoc) heredoc = null
      return true
    }
    heredoc = /<<-?\s*['"]?(\w+)['"]?/.exec(line)?.[1] ?? null
    return i > 0 && continues(lines[i - 1]!, line)
  })
}

/**
 * Commands as they'd appear in the user's terminal: a prompt before each command,
 * "> " before lines that continue one (after a trailing `\` or `|`, inside a
 * loop or an if, or inside a here document).
 */
export function ShellCommand({ command, user }: { command: string; user?: string }) {
  const prompt = promptFor(user)
  const lines = command.split('\n')
  const continued = continuations(lines)
  return (
    <pre className="overflow-x-auto rounded-lg bg-code p-3 font-mono text-sm text-[#e6edf3]">
      {lines.map((line, i) => (
        <span key={i}>
          <span className="select-none text-[#8fd9ad]">{continued[i] ? '> ' : prompt}</span>
          {line}
          {i < lines.length - 1 && '\n'}
        </span>
      ))}
    </pre>
  )
}
