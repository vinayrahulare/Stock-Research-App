from decimal import Decimal
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import AuditLog as AuditLogModel
from .models import DividendHolding as DividendHoldingModel
from .schemas import AuditLogEntry, DividendHolding, DividendHoldingCreate, StatsResponse


def _model_to_schema(m: DividendHoldingModel) -> DividendHolding:
    return DividendHolding(
        id=m.id,
        ticker=m.ticker,
        company=m.company,
        sector=m.sector,
        price=m.price,
        pe=m.pe,
        annual_div=m.annual_div,
        current_yield=m.current_yield,
        avg_yield_5y=m.avg_yield_5y,
        valuation=m.valuation,
        payout_pct=m.payout_pct,
        growth_5y=m.growth_5y,
        si_verdict=m.si_verdict,
        why_it_fits=m.why_it_fits,
        created_at=m.created_at,
    )


class HoldingStore:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> List[DividendHolding]:
        rows = self.db.query(DividendHoldingModel).order_by(
            DividendHoldingModel.valuation.asc(),
            DividendHoldingModel.ticker.asc(),
        ).all()
        return [_model_to_schema(r) for r in rows]

    def _apply_filters(self, q, filters: Dict[str, Any]):
        if not filters:
            return q
        if filters.get("ticker"):
            q = q.filter(DividendHoldingModel.ticker == filters["ticker"].strip())
        if filters.get("ticker_search"):
            q = q.filter(
                DividendHoldingModel.ticker.ilike(
                    f"%{filters['ticker_search'].strip()}%"
                )
            )
        if filters.get("company"):
            q = q.filter(DividendHoldingModel.company == filters["company"].strip())
        if filters.get("sector"):
            q = q.filter(DividendHoldingModel.sector == filters["sector"].strip())
        if filters.get("valuation"):
            q = q.filter(DividendHoldingModel.valuation == filters["valuation"].strip())
        if filters.get("si_verdict"):
            q = q.filter(
                DividendHoldingModel.si_verdict == filters["si_verdict"].strip()
            )
        if filters.get("why_it_fits"):
            q = q.filter(
                DividendHoldingModel.why_it_fits == filters["why_it_fits"].strip()
            )
        return q

    def list_filtered(
        self,
        filters: Optional[Dict[str, str]] = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "valuation",
        sort_order: str = "asc",
    ) -> List[DividendHolding]:
        sort_columns = {
            "ticker": DividendHoldingModel.ticker,
            "company": DividendHoldingModel.company,
            "sector": DividendHoldingModel.sector,
            "price": DividendHoldingModel.price,
            "pe": DividendHoldingModel.pe,
            "annual_div": DividendHoldingModel.annual_div,
            "current_yield": DividendHoldingModel.current_yield,
            "valuation": DividendHoldingModel.valuation,
            "si_verdict": DividendHoldingModel.si_verdict,
            "why_it_fits": DividendHoldingModel.why_it_fits,
        }
        sort_col = sort_columns.get(sort_by, DividendHoldingModel.valuation)
        q = self.db.query(DividendHoldingModel)
        q = self._apply_filters(q, filters or {})
        if sort_order == "desc":
            q = q.order_by(sort_col.desc(), DividendHoldingModel.ticker.asc())
        else:
            q = q.order_by(sort_col.asc(), DividendHoldingModel.ticker.asc())
        rows = q.offset(skip).limit(limit).all()
        return [_model_to_schema(r) for r in rows]

    def count_filtered(self, filters: Optional[Dict[str, str]] = None) -> int:
        q = self.db.query(func.count(DividendHoldingModel.id))
        q = self._apply_filters(q, filters or {})
        return q.scalar() or 0

    def purge(self) -> int:
        deleted = self.db.query(DividendHoldingModel).delete()
        self.db.commit()
        return deleted

    def create_audit_log(
        self,
        *,
        action: str,
        file_name: str | None,
        imported_count: int,
        updated_count: int,
        status: str,
        message: str,
    ) -> AuditLogEntry:
        row = AuditLogModel(
            action=action,
            file_name=file_name,
            imported_count=imported_count,
            updated_count=updated_count,
            status=status,
            message=message,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return AuditLogEntry.model_validate(row)

    def list_audit_logs(self, limit: int = 100) -> List[AuditLogEntry]:
        rows = (
            self.db.query(AuditLogModel)
            .order_by(AuditLogModel.created_at.desc())
            .limit(max(1, min(limit, 500)))
            .all()
        )
        return [AuditLogEntry.model_validate(r) for r in rows]

    def get_filter_options(self) -> Dict[str, List[str]]:
        def distinct_values(column) -> List[str]:
            rows = (
                self.db.query(column)
                .filter(column.isnot(None))
                .distinct()
                .order_by(column.asc())
                .all()
            )
            return [str(value).strip() for (value,) in rows if value and str(value).strip()]

        return {
            "ticker": distinct_values(DividendHoldingModel.ticker),
            "company": distinct_values(DividendHoldingModel.company),
            "sector": distinct_values(DividendHoldingModel.sector),
            "valuation": distinct_values(DividendHoldingModel.valuation),
            "si_verdict": distinct_values(DividendHoldingModel.si_verdict),
            "why_it_fits": distinct_values(DividendHoldingModel.why_it_fits),
        }

    def get_by_ticker(self, ticker: str) -> Optional[DividendHolding]:
        row = self.db.query(DividendHoldingModel).filter(
            DividendHoldingModel.ticker == ticker
        ).first()
        return _model_to_schema(row) if row else None

    def upsert(self, data: DividendHoldingCreate) -> DividendHolding:
        row = self.db.query(DividendHoldingModel).filter(
            DividendHoldingModel.ticker == data.ticker
        ).first()
        payload = data.model_dump()
        if row:
            for k, v in payload.items():
                setattr(row, k, v)
            self.db.commit()
            self.db.refresh(row)
            return _model_to_schema(row)
        row = DividendHoldingModel(**payload)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return _model_to_schema(row)

    def bulk_upsert(self, items: List[DividendHoldingCreate]) -> int:
        count = 0
        for data in items:
            self.upsert(data)
            count += 1
        return count

    def existing_tickers(self, tickers: List[str]) -> Set[str]:
        if not tickers:
            return set()
        rows = (
            self.db.query(DividendHoldingModel.ticker)
            .filter(DividendHoldingModel.ticker.in_(tickers))
            .all()
        )
        return {ticker for (ticker,) in rows}

    def bulk_upsert_counts(self, items: List[DividendHoldingCreate]) -> dict:
        imported = 0
        updated = 0
        for data in items:
            exists = (
                self.db.query(DividendHoldingModel.id)
                .filter(DividendHoldingModel.ticker == data.ticker)
                .first()
            )
            if exists:
                updated += 1
            else:
                imported += 1
            self.upsert(data)
        return {"imported": imported, "updated": updated, "total": imported + updated}

    def stats(self) -> dict:
        total = self.db.query(func.count(DividendHoldingModel.id)).scalar() or 0
        if total == 0:
            return {"total": 0, "avg_yield": None, "undervalued_count": 0}
        avg = self.db.query(func.avg(DividendHoldingModel.current_yield)).scalar()
        undervalued = self.db.query(func.count(DividendHoldingModel.id)).filter(
            func.lower(DividendHoldingModel.valuation).like("under%")
        ).scalar() or 0
        return {
            "total": total,
            "avg_yield": float(avg) if avg is not None else None,
            "undervalued_count": undervalued,
        }
