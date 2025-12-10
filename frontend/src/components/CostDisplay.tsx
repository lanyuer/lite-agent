import React from 'react';
import { DollarSign, Zap } from 'lucide-react';
import type { UsageInfo } from '../lib/EventProcessor';
import './CostDisplay.css';

interface CostDisplayProps {
    usage?: UsageInfo;
    cumulativeUsage?: {
        total_cost_usd?: number;
        total_input_tokens?: number;
        total_output_tokens?: number;
    };
    showCumulative?: boolean; // Whether to show cumulative usage
}

export const CostDisplay: React.FC<CostDisplayProps> = ({ usage, cumulativeUsage, showCumulative = false }) => {
    console.log('[CostDisplay] Received usage:', usage, 'cumulativeUsage:', cumulativeUsage);
    
    // Use cumulative usage if available and showCumulative is true, otherwise use current usage
    const displayUsage = showCumulative && cumulativeUsage ? {
        total_cost_usd: cumulativeUsage.total_cost_usd || 0,
        input_tokens: cumulativeUsage.total_input_tokens || 0,
        output_tokens: cumulativeUsage.total_output_tokens || 0,
    } : usage;
    
    if (!displayUsage) {
        console.log('[CostDisplay] No usage provided');
        return null;
    }

    // Use snake_case field names
    const totalCost = displayUsage.total_cost_usd || 0;
    const inputTokens = displayUsage.input_tokens || displayUsage.inputTokens || 0;
    const outputTokens = displayUsage.output_tokens || displayUsage.outputTokens || 0;
    const cacheReadTokens = displayUsage.cache_read_input_tokens || displayUsage.cacheReadInputTokens || 0;
    const totalTokens = inputTokens + outputTokens;

    console.log('[CostDisplay] Calculated values:', { totalCost, totalTokens, inputTokens, outputTokens, cacheReadTokens });

    // Show if we have cost OR tokens (not requiring both)
    if (totalCost === 0 && totalTokens === 0) {
        console.log('[CostDisplay] No meaningful data (cost=0, tokens=0), not showing');
        return null;
    }
    
    console.log('[CostDisplay] Will render with cost:', totalCost, 'tokens:', totalTokens, 'showCumulative:', showCumulative);

    return (
        <div className="cost-display">
            <div className="cost-display-content">
                <div className="cost-main">
                    <DollarSign size={12} className="cost-icon" />
                    <span className="cost-amount">
                        ${totalCost.toFixed(4)}
                    </span>
                    {showCumulative && cumulativeUsage && (
                        <span className="cumulative-label" title="Cumulative cost for this task">
                            (total)
                        </span>
                    )}
                </div>
                <div className="cost-details">
                    <div className="cost-token-info">
                        <Zap size={10} className="token-icon" />
                        <span className="token-count">
                            {totalTokens.toLocaleString()}
                        </span>
                        {cacheReadTokens > 0 && (
                            <span className="cache-badge" title="Cache hits">
                                {cacheReadTokens.toLocaleString()} cached
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

