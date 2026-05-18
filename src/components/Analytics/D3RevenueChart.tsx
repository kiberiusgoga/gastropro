import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DailyStats } from '../../types';

interface D3RevenueChartProps {
  stats: DailyStats[];
  isDarkMode: boolean;
}

const D3RevenueChart: React.FC<D3RevenueChartProps> = ({ stats, isDarkMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || stats.length === 0) return;

    const data = stats.map(d => ({
      date: d.date,
      revenue: d.revenue
    }));

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
      .domain(data.map(d => d.date))
      .range([0, width]);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("fill", "#8c8279")
      .style("font-size", "10px");

    const y = d3.scaleLinear()
      .domain([0, (d3.max(data, (d: {date: string, revenue: number}) => d.revenue) as unknown as number) || 0])
      .range([height, 0]);

    svg.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("fill", "#8c8279");

    const line = d3.line<{date: string, revenue: number}>()
      .x(d => x(d.date) as number || 0)
      .y(d => y(d.revenue));

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#c2652a")
      .attr("stroke-width", 3)
      .attr("d", line);

    const area = d3.area<{date: string, revenue: number}>()
      .x(d => x(d.date) as number || 0)
      .y0(height)
      .y1(d => y(d.revenue));

    svg.append("path")
      .datum(data)
      .attr("fill", "#c2652a")
      .attr("fill-opacity", 0.12)
      .attr("d", area);

    svg.selectAll("dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.date) as number || 0)
      .attr("cy", (d) => y(d.revenue))
      .attr("r", 5)
      .attr("fill", "#c2652a")
      .attr("stroke", "#252118")
      .attr("stroke-width", 2);

    svg.selectAll(".domain").remove();
    svg.selectAll(".tick line").attr("stroke", "#2e2921");

  }, [stats, isDarkMode]);

  return (
    <div className="flex justify-center items-center bg-surface-2/50 p-6 rounded-3xl border border-warm-line overflow-x-auto">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default D3RevenueChart;
