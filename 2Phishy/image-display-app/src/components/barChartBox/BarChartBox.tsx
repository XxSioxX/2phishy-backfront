import { Bar, BarChart, ResponsiveContainer, Tooltip } from "recharts";
import "./barChartBox.scss";

type Props = {
    title:string;
    color:string;
    dataKey:string;
    chartData:object[];
    onViewAll?: () => void;
}

const BarChartBox = (props: Props) => {
    const handleViewAll = (e: React.MouseEvent) => {
        if (props.onViewAll) {
            e.preventDefault();
            props.onViewAll();
        }
    };

    return (
        <div className="barChartBox">
            <div className="header">
                <h1>{props.title}</h1>
                {props.onViewAll && (
                    <a href="#" onClick={handleViewAll} style={{color: props.color, fontSize: '14px'}}>View all</a>
                )}
            </div>
            <div className="chart">
                <ResponsiveContainer width="99%" height={150}>
                    <BarChart data={props.chartData}>
                        <Tooltip
                        contentStyle={{background: "#2a3447", borderRadius:"5px"}}
                        labelStyle={{display:"none"}}
                        cursor={{fill:"none"}}
                        />
                        <Bar dataKey={props.dataKey} fill={props.color} />
                        </BarChart>
                        </ResponsiveContainer>
            </div>
        </div>

    );
};

export default BarChartBox;