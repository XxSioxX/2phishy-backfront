import React from "react";

const AbadiaPage: React.FC = () => {
	return (
		<div style={{height: "100%", display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"}}>
			<iframe
				title="Abadia Game"
				src="/abadia/index.html"
				style={{width: "820px", height: "640px", border: "0", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,.35)"}}
				allowFullScreen
			/>
		</div>
	);
};

export default AbadiaPage; 