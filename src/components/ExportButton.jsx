import { TAGS } from "../App";

export default function ExportButton({ properties, single }) {
  const handleExport = () => {
    const headers = [
      "Address", "Confirmed Address", "Vacancy Status", "Vacancy Override",
      "Status Tag", "Owner Entity (Vacancy Tax)", "Owner Name (ATTOM)",
      "Year Built", "Building Size", "Floors", "Land Use", "APN",
      "Last Sale Date", "Last Sale Price",
      "Last Business", "Notes", "Looked Up At",
    ];

    const rows = properties.map((p) => {
      const ownerEntity = p.vacancyData?.[0]?.entity || "";
      const tag = p.tag ? (TAGS.find(t => t.id === p.tag)?.label || p.tag) : "";
      return [
        p.address,
        p.confirmedAddress || "",
        p.vacancyStatus,
        p.vacancyOverride || "",
        tag,
        ownerEntity,
        p.ownerName || "",
        p.yearBuilt || "",
        p.buildingSize || "",
        p.levels || "",
        p.landUse || "",
        p.apn || "",
        p.lastSaleDate || "",
        p.lastSaleAmount || "",
        p.lastBusiness || "",
        (p.notes || "").replace(/\n/g, " | "),
        new Date(p.lookedUpAt).toLocaleString(),
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = single
      ? `vtv-${(properties[0].confirmedAddress || properties[0].address).replace(/\s+/g, "-")}.csv`
      : `vtv-properties-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="export-btn" onClick={handleExport}>
      ↓ Export {single ? "CSV" : `${properties.length} Properties`}
    </button>
  );
}
