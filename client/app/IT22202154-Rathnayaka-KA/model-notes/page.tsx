import DashboardShell from "../components/dashboard-shell";

export default function ModelNotesPage() {
  return <DashboardShell active="notes">
    <header className="content-header"><div><p className="section-kicker">Research / Method notes</p><h1>Model notes</h1><p className="content-lede">A clear reference for the model inputs, outputs and the decision boundary used in this console.</p></div></header>
    <section className="notes-page-grid">
      <article className="note-detail-card"><span className="note-number">01</span><h2>Capture the shift</h2><p>The supervisor enters department, team number, batch quantity, production date, workers, overtime, SMV and machine breakdown minutes.</p><div className="note-fact"><span>Input signals</span><strong>08</strong></div></article>
      <article className="note-detail-card"><span className="note-number">02</span><h2>Predict the risk</h2><p>The trained Random Forest regression pipeline estimates productivity. The API then derives efficiency level, delay outlook and expected completion time.</p><div className="note-fact"><span>Model</span><strong>Random Forest / 500 trees</strong></div></article>
      <article className="note-detail-card"><span className="note-number">03</span><h2>Store the evidence</h2><p>Each successful request is recorded in PostgreSQL with its input profile and output values, creating a traceable history for review.</p><div className="note-fact"><span>Table</span><strong>prediction_runs</strong></div></article>
      <article className="note-detail-card note-detail-dark"><span className="note-number">04</span><h2>Act before the miss</h2><p>Use the productivity score, delay classification and completion estimate as an early operational signal. The model supports a supervisor decision; it does not replace floor judgement.</p><div className="note-fact"><span>Project</span><strong>R26-IT-140 / IT22202154</strong></div></article>
    </section>
  </DashboardShell>;
}
