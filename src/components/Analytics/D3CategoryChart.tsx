import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DailyStats, MenuItem } from '../../types';

interface D3CategoryChartProps {
  stats: DailyStats[];
  menu: MenuItem[];
  isDarkMode: boolean;
}

const D3CategoryChart: React.FC<D3CategoryChartProps> = ({ stats, menu, isDarkMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || stats.length === 0) return;

    const categorySales: Record<string, number> = {};

    stats.forEach(day => {
      day.topItems.forEach(item => {
        const menuItem = menu.find(m => m.name === item.name);
        if (menuItem) {
          const cat = menuItem.categoryName || 'Other';
          categorySales[cat] = (categorySales[cat] || 0) + item.count;
        }
      });
    });

    const data = Object.entries(categorySales).map(([category, count]) => ({
      category,
      count: count as number
    })).sort((a, b) => b.count - a.count);

    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, (d3.max(data, (d: {category: string, count: number}) => d.count) as unknown as number) || 0])
      .range([0, width]);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .selectAll("text")
      .attr("fill", "#8c8279");

    const y = d3.scaleBand()
      .range([0, height])
      .domain(data.map(d => d.category))
      .padding(.2);

    svg.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .attr("fill", "#b8aa97")
      .style("font-weight", "700");

    svg.selectAll("myRect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", x(0))
      .attr("y", (d) => y(d.category) || 0)
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .attr("fill", "#c2652a")
      .attr("rx", 4)
      .transition()
      .duration(800)
      .attr("width", (d) => x(d.count));

    svg.selectAll(".domain").remove();
    svg.selectAll(".tick line").attr("stroke", "#2e2921");

  }, [stats, menu, isDarkMode]);

  return (
    <div className="flex justify-center items-center bg-surface-2/50 p-6 rounded-3xl border border-warm-line overflow-x-auto">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default D3CategoryChart;
