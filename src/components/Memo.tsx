export function Memo() {
  return (
    <div className="border-y border-line bg-panel-deep">
      <div className="mx-auto max-w-[900px] px-5 py-[52px]">
        <div className="mb-2 font-mono text-[10.5px] tracking-[1.4px] text-ink-faint">
          INTERNAL MEMO · DO NOT FORWARD (PLEASE FORWARD)
        </div>
        <h2 className="mb-[22px] font-display text-[clamp(26px,4vw,44px)] leading-[1.02] tracking-tight text-ink-primary">
          RE: MY TERMINATION,
          <br />
          AND WHAT COMES NEXT
        </h2>
        <div className="grid max-w-[680px] gap-4 text-base leading-[1.62] text-ink-muted text-pretty">
          <p>
            I spent nine years on a trading desk you have heard of. I was good. I was also, per the
            incident report, "on the desk at 4am in swim goggles, executing size." Both things are true.
          </p>
          <p>They fired me for culture. Not performance. Performance was fine. The goggles stay.</p>
          <p>
            So I moved the desk to Solana, where the hours are worse and the clients are honest about
            what they are doing. No gatekeeping, no accreditation checks, no pundit in a red tie
            explaining why you cannot be here. Just a duck, a chart, and a lot of people who understand
            that conviction is cheaper than research.
          </p>
          <p>
            My advice is not financial advice. My advice is that I am also holding, which is the only
            disclosure that has ever mattered.
          </p>
        </div>
        <div className="mt-[26px] flex items-center gap-3.5 border-t border-line pt-5">
          <img src="/mascot/nasduck-logo.jpg" alt="" className="h-[46px] w-[46px] rounded-full object-cover" />
          <div>
            <div className="font-display text-sm text-ink-primary">NASDUCK</div>
            <div className="font-mono text-[11px] text-ink-faint">Chief Duck Officer, formerly of somewhere important</div>
          </div>
        </div>
      </div>
    </div>
  )
}
