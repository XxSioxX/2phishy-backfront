import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import "./bigChartBox.scss"

const data = [
    { name: "Sun", minscore: 907, maxscore: 3909, seconds: 2565 },
    { name: "Mon", minscore: 1249, maxscore: 2269, seconds: 2702 },
    { name: "Tues", minscore: 831, maxscore: 3719, seconds: 5620 },
    { name: "Wed", minscore: 1276, maxscore: 3028, seconds: 2874 },
    { name: "Thu", minscore: 1017, maxscore: 2789, seconds: 2693 },
    { name: "Fri", minscore: 1464, maxscore: 4898, seconds: 2957 },
    { name: "Sat", minscore: 682, maxscore: 4332, seconds: 2700 },
];

const BigChartBox = () => {
  return (
    <div className="bigChartBox">
        <h1>User Analytics</h1>
        <div className="chart">
            
        <ResponsiveContainer width="99%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="minscore" stackId="1" stroke="#8884d8" fill="#8884d8" />
          <Area type="monotone" dataKey="maxscore" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
          <Area type="monotone" dataKey="seconds" stackId="1" stroke="#ffc658" fill="#ffc658" />
        </AreaChart>
      </ResponsiveContainer>
        </div>
    </div>
  )
}

export default BigChartBox